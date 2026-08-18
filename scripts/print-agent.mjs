#!/usr/bin/env node
/**
 * Agente de impresion de BARZUO.
 *
 * Corre DENTRO del local (un PC que quede encendido, o una Raspberry Pi) y es
 * el puente entre la web y las impresoras termicas. La web esta en internet y
 * las impresoras estan detras del router del bar: el servidor no puede
 * alcanzarlas, asi que la conexion la abre el local hacia afuera.
 *
 * Cada pocos segundos pregunta si hay comandas, las imprime por ESC/POS en el
 * puerto 9100 y avisa como le fue. Si algo falla, la comanda queda en la cola
 * del servidor y se reintenta: no se pierde un pedido porque falte papel.
 *
 * Con una sola impresora, las comandas de un mismo envio salen en una unica
 * tira con una linea de corte en el medio: un viaje del garzon, un papel que
 * se parte en dos. Con una impresora por estacion cada una sale por su ranura.
 * Ver `agrupar`.
 *
 * Uso, con una sola impresora (el caso del local):
 *   BARZUO_URL=https://barzuo.com \
 *   PRINT_AGENT_TOKEN=... \
 *   PRINTER_DEFAULT=/dev/usb/lp0 \
 *   node scripts/print-agent.mjs
 *
 * Con una por estacion, se nombran y dejan de usar la de respaldo:
 *   PRINTER_COCINA=192.168.1.50 PRINTER_BARRA=192.168.1.51 ...
 *
 * No necesita instalar nada: solo Node 18 o superior.
 */

import { writeFile } from "node:fs/promises";
import { Socket } from "node:net";

/**
 * Un numero de la configuracion, con su valor por defecto.
 *
 * `Number(process.env.X ?? 10)` parece hacer esto y no lo hace: `??` solo
 * atrapa la variable sin definir. Una variable definida pero vacia —que es
 * como queda al escribir `PRINT_TIP_PERCENT=` en un archivo de entorno, o al
 * pasarla desde un panel de despliegue sin llenarla— da `Number("")`, o sea
 * cero. Y un cero aca apaga la propina en silencio: el papel sale sin ella y
 * no hay nada en ningun registro que explique por que.
 */
function num(valor, porDefecto) {
  const parsed = Number(valor);
  return valor === undefined || valor === "" || Number.isNaN(parsed)
    ? porDefecto
    : parsed;
}

const CONFIG = {
  url: (process.env.BARZUO_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  token: process.env.PRINT_AGENT_TOKEN ?? "",
  intervalMs: num(process.env.PRINT_POLL_MS, 4000),
  printers: {
    /*
     * La impresora que recibe todo lo que no tenga una propia.
     *
     * Es el caso del local hoy: una sola termica colgada del USB del PC de la
     * pantalla tactil. Los tres papeles —barra, cocina y el resumen del
     * cobro— salen por ahi, y se distinguen por como estan impresos (ver
     * `encabezado`). Cuando lleguen las otras impresoras basta con nombrarlas
     * abajo: lo que tenga la suya deja de usar esta.
     */
    DEFAULT: process.env.PRINTER_DEFAULT ?? "",
    COCINA: process.env.PRINTER_COCINA ?? "",
    BARRA: process.env.PRINTER_BARRA ?? "",
    CAJA: process.env.PRINTER_CAJA ?? "",
  },
  /** Ancho del papel en caracteres. 48 = 80mm, 32 = 58mm. */
  width: num(process.env.PRINT_WIDTH, 48),
  /*
   * Pausa entre dos papeles seguidos de la MISMA impresora.
   *
   * Con una sola termica, la comanda de barra y la de cocina salen una detras
   * de otra en menos de un segundo: si el garzon no llega a tiempo, la segunda
   * cae sobre la primera y hay que separarlas a mano en medio del servicio.
   * Unos segundos alcanzan para retirar la anterior. Entre impresoras
   * distintas no se espera: ahi no hay nada que se encime.
   */
  gapMs: num(process.env.PRINT_GAP_MS, 3000),
  /*
   * Propina sugerida en el papel del cliente, en porcentaje.
   *
   * El papel del cobro se le pasa al cliente para que revise el total, asi que
   * ademas del total va la suma con la propina ya hecha: es la cuenta que
   * igual iba a hacer de cabeza o preguntando. En Chile el 10% es lo
   * acostumbrado y es voluntario — el papel lo dice con todas las letras y el
   * TOTAL a pagar sigue siendo el numero grande, para que nadie confunda una
   * sugerencia con lo que debe.
   *
   * En 0 el bloque no se imprime.
   */
  tipPercent: num(process.env.PRINT_TIP_PERCENT, 10),
};

if (!CONFIG.token) {
  console.error("Falta PRINT_AGENT_TOKEN (el mismo que en el servidor).");
  process.exit(1);
}

if (!Object.values(CONFIG.printers).some(Boolean)) {
  console.error(
    "Configura al menos PRINTER_DEFAULT (una sola impresora para todo)\n" +
      "o alguna de PRINTER_COCINA / PRINTER_BARRA / PRINTER_CAJA.",
  );
  process.exit(1);
}

/** A que impresora va cada papel, con la unica como respaldo. */
function printerFor(ticket) {
  const propia =
    ticket.kind === "COBRO" ? CONFIG.printers.CAJA : CONFIG.printers[ticket.station];

  return propia || CONFIG.printers.DEFAULT;
}

// --- ESC/POS -----------------------------------------------------------------

const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  init: Buffer.from([ESC, 0x40]),
  // Codepage 1252: acentos y enes salen bien en la mayoria de las termicas.
  codepage: Buffer.from([ESC, 0x74, 16]),
  alignLeft: Buffer.from([ESC, 0x61, 0]),
  alignCenter: Buffer.from([ESC, 0x61, 1]),
  boldOn: Buffer.from([ESC, 0x45, 1]),
  boldOff: Buffer.from([ESC, 0x45, 0]),
  doubleOn: Buffer.from([GS, 0x21, 0x11]),
  doubleOff: Buffer.from([GS, 0x21, 0x00]),
  // Video inverso: letras blancas sobre una banda negra. Es lo que se ve de
  // lejos y sin leer, y por eso lleva el destino del papel.
  reverseOn: Buffer.from([GS, 0x42, 1]),
  reverseOff: Buffer.from([GS, 0x42, 0]),
  feed: (lines) => Buffer.from([ESC, 0x64, lines]),
  cut: Buffer.from([GS, 0x56, 66, 0]),
  // Dos pitidos: en una cocina ruidosa la comanda pasa desapercibida.
  beep: Buffer.from([ESC, 0x42, 2, 3]),
};

function text(value) {
  return Buffer.from(`${value}\n`, "latin1");
}

function rule(char = "-") {
  return text(char.repeat(CONFIG.width));
}

/**
 * Parte un texto largo en varias lineas sin cortar palabras.
 *
 * Los nombres de la carta son largos ("Chorrillana vegetariana para
 * compartir") y una comanda cortada a la mitad no se entiende.
 */
function wrap(value, width) {
  const words = String(value).split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

/**
 * Como se reconoce cada papel sin leerlo.
 *
 * Con una sola impresora, los tres tipos salen por la misma ranura y caen uno
 * encima de otro. Quien los recoge esta en medio del servicio y no va a
 * ponerse a leer: tiene que ver de un vistazo si eso va a la barra, a la
 * cocina o al cliente.
 *
 * Por eso cada uno lleva dos marcas que se leen a distancia: una banda negra
 * de ancho completo con la palabra en letra doble, y una textura propia de
 * relleno alrededor. La banda se ve desde el otro lado del mesón; la textura
 * distingue barra de cocina aunque el papel quede boca abajo o doblado.
 */
const ENCABEZADOS = {
  BARRA: { titulo: "BARRA", marca: "*", },
  COCINA: { titulo: "COCINA", marca: "#" },
  COBRO: { titulo: "COBRO", marca: "$" },
};

/** Banda negra de ancho completo con el destino del papel. */
function encabezado(clave) {
  const { titulo, marca } = ENCABEZADOS[clave] ?? ENCABEZADOS.COCINA;
  const parts = [CMD.alignCenter];

  // La franja de marcas enmarca la banda y da la textura que diferencia los
  // tipos entre si de un vistazo.
  parts.push(CMD.boldOn, text(marca.repeat(CONFIG.width)), CMD.boldOff);

  // Centrado a mano: en letra doble entran la mitad de caracteres, asi que el
  // centrado de la impresora deja la banda corta y no se ve como una franja.
  const ancho = Math.floor(CONFIG.width / 2);
  const relleno = Math.max(0, ancho - titulo.length - 2);
  const izquierda = " ".repeat(Math.floor(relleno / 2) + 1);
  const derecha = " ".repeat(Math.ceil(relleno / 2) + 1);

  parts.push(CMD.doubleOn, CMD.reverseOn);
  parts.push(text(`${izquierda}${titulo}${derecha}`));
  parts.push(CMD.reverseOff, CMD.doubleOff);

  parts.push(CMD.boldOn, text(marca.repeat(CONFIG.width)), CMD.boldOff);

  return parts;
}

/**
 * La linea por donde se parte un papel compartido.
 *
 * No se manda un corte de la impresora: en las termicas baratas "corte
 * parcial" a veces corta entero, y ahi las dos mitades se separan y caen — que
 * es exactamente lo que este papel viene a evitar. Una guia impresa con aire
 * alrededor se rompe con las dos manos, sale siempre igual en cualquier
 * maquina, y deja el papel entero hasta que alguien decide partirlo.
 */
function lineaDeCorte() {
  const leyenda = " CORTAR AQUI ";
  const guiones = Math.max(0, CONFIG.width - leyenda.length);
  const izquierda = "-".repeat(Math.floor(guiones / 2));
  const derecha = "-".repeat(Math.ceil(guiones / 2));

  return [
    CMD.feed(2),
    CMD.alignCenter,
    CMD.boldOn,
    text(`${izquierda}${leyenda}${derecha}`),
    CMD.boldOff,
    CMD.feed(2),
    CMD.alignLeft,
  ];
}

/**
 * El cuerpo de una comanda, sin abrir ni cerrar el papel.
 *
 * Va aparte de `renderTicket` porque con una sola impresora dos comandas del
 * mismo envio se imprimen una debajo de la otra en un unico papel: cada una
 * necesita su cuerpo entero —su banda negra, su mesa, sus productos— pero solo
 * el papel completo lleva el corte del final.
 *
 * `parte` y `total` numeran las mitades cuando son varias. Sirve para lo unico
 * que la garzona no puede verificar de otra forma: que no se dejo la otra
 * mitad en la bandeja.
 */
function cuerpoComanda(ticket, parte = 1, total = 1) {
  const parts = [];

  parts.push(...encabezado(ticket.station));

  parts.push(CMD.alignCenter, CMD.doubleOn, CMD.boldOn);
  parts.push(text(`MESA ${ticket.table.number}`));
  parts.push(CMD.doubleOff, CMD.boldOff);

  if (ticket.table.name) parts.push(text(ticket.table.name));

  // Solo cuando el papel viene partido: en una comanda sola seria una linea de
  // ruido que hay que leer para descartar.
  if (total > 1) {
    parts.push(CMD.boldOn, text(`PARTE ${parte} DE ${total}`), CMD.boldOff);
  }

  parts.push(CMD.alignLeft, rule("="));

  const hora = new Date(ticket.createdAt).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Numero a la izquierda y hora pegada al margen derecho.
  const etiqueta = `Comanda #${ticket.number}`;
  const relleno = Math.max(1, CONFIG.width - etiqueta.length - hora.length);

  parts.push(text(`${etiqueta}${" ".repeat(relleno)}${hora}`));

  // Quien la mando. En la bandeja se juntan los papeles de varias mesas y de
  // varios garzones; el nombre es como cada uno reconoce los suyos.
  if (ticket.waiter) parts.push(text(`Mando: ${ticket.waiter}`));

  parts.push(rule("="));

  // Agrupado por comensal: la barra arma los tragos separados y el garzon
  // sabe delante de quien va cada uno.
  const grupos = new Map();

  for (const item of ticket.items) {
    const clave = item.diner ?? "";
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(item);
  }

  for (const [comensal, items] of grupos) {
    if (comensal) {
      parts.push(CMD.boldOn, text(`> ${comensal}`), CMD.boldOff);
    }

    for (const item of items) {
      const prefijo = `${item.quantity} x `;
      const lineas = wrap(item.name, CONFIG.width - prefijo.length);

      parts.push(CMD.doubleOn, text(`${prefijo}${lineas[0]}`), CMD.doubleOff);

      for (const extra of lineas.slice(1)) {
        parts.push(text(`${" ".repeat(prefijo.length)}${extra}`));
      }

      if (item.note) {
        for (const linea of wrap(`** ${item.note}`, CONFIG.width - 2)) {
          parts.push(CMD.boldOn, text(`  ${linea}`), CMD.boldOff);
        }
      }
    }

    parts.push(text(""));
  }

  parts.push(rule("-"));
  parts.push(text(ticket.sessionCode));

  return parts;
}

/** Arma el ticket completo tal como sale por la impresora. */
function renderTicket(ticket) {
  if (ticket.kind === "COBRO") return renderCobro(ticket);

  return Buffer.concat([
    CMD.init,
    CMD.codepage,
    CMD.beep,
    ...cuerpoComanda(ticket),
    CMD.feed(3),
    CMD.cut,
  ]);
}

/**
 * Un envio entero en un solo papel.
 *
 * La mesa que pide una picada y dos schops genera dos comandas, y con una sola
 * impresora salian de a una con segundos de espera entre medio para que no se
 * encimaran: la garzona se quedaba parada al lado de la ranura esperando la
 * segunda, o volvia despues y se encontraba con los papeles de otra mesa
 * mezclados encima del suyo.
 *
 * Ahora salen juntas en una tira continua, con la linea de corte entre las dos.
 * Retira una vez, la parte en dos y reparte. Un solo pitido, un solo corte, un
 * solo viaje.
 */
function renderLote(tickets) {
  if (tickets.length === 1) return renderTicket(tickets[0]);

  const parts = [CMD.init, CMD.codepage, CMD.beep];

  tickets.forEach((ticket, indice) => {
    if (indice > 0) parts.push(...lineaDeCorte());
    parts.push(...cuerpoComanda(ticket, indice + 1, tickets.length));
  });

  parts.push(CMD.feed(3), CMD.cut);

  return Buffer.concat(parts);
}

/** Precio en pesos, como se imprime. */
function money(cents) {
  return `$${Math.round(cents / 100).toLocaleString("es-CL")}`;
}

/**
 * Dos textos en la misma linea, uno pegado a cada margen.
 *
 * `ancho` existe para las lineas en letra doble: ahi entra la mitad de
 * caracteres, y calcular el relleno sobre el ancho normal empuja el importe a
 * la linea siguiente — justo en el TOTAL, que es lo unico que el cliente mira.
 */
function fila(izquierda, derecha, ancho = CONFIG.width) {
  const relleno = Math.max(1, ancho - izquierda.length - derecha.length);
  return text(`${izquierda}${" ".repeat(relleno)}${derecha}`);
}

/**
 * Resumen de un cobro.
 *
 * Es el papel que se le pasa al cliente, asi que no lleva el detalle de
 * preparacion ni las notas de cocina: lo que pidio, lo que costo, como pago y
 * el numero de comprobante por si despues reclama.
 *
 * Los importes vienen calculados por el servidor. El agente no suma nada: si
 * sumara por su cuenta, un redondeo distinto haria que el papel y la caja no
 * cuadraran.
 */
function renderCobro(ticket) {
  const pago = ticket.payment;
  const parts = [CMD.init, CMD.codepage];

  parts.push(...encabezado("COBRO"));

  parts.push(CMD.alignCenter, CMD.boldOn);
  parts.push(text(`MESA ${ticket.table.number}`));
  parts.push(CMD.boldOff);

  // Cobrar a una persona no cierra la mesa: hay que poder distinguir su papel
  // del de los demas comensales de la misma mesa.
  parts.push(text(pago.dinerLabel ? `Cuenta de ${pago.dinerLabel}` : "Cuenta completa"));

  const fecha = new Date(pago.paidAt).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  parts.push(CMD.alignLeft, rule("="));
  parts.push(text(fecha));
  parts.push(rule("-"));

  for (const linea of pago.lines) {
    const importe = money(linea.totalCents);
    const prefijo = `${linea.quantity} x `;
    const lineas = wrap(linea.name, CONFIG.width - prefijo.length - importe.length - 1);

    parts.push(fila(`${prefijo}${lineas[0]}`, importe));

    for (const extra of lineas.slice(1)) {
      parts.push(text(`${" ".repeat(prefijo.length)}${extra}`));
    }
  }

  parts.push(rule("-"));

  // El subtotal solo aporta cuando hubo descuento; si no, repite el total.
  if (pago.discountCents > 0) {
    parts.push(fila("Subtotal", money(pago.subtotalCents)));
    parts.push(fila("Descuentos", `-${money(pago.discountCents)}`));
  }

  parts.push(CMD.doubleOn, CMD.boldOn);
  parts.push(fila("TOTAL", money(pago.totalCents), Math.floor(CONFIG.width / 2)));
  parts.push(CMD.doubleOff, CMD.boldOff);

  /*
   * La propina, ya sumada.
   *
   * Va debajo del total y en letra normal, no en doble: el numero grande tiene
   * que seguir siendo lo que el cliente debe. Una sugerencia impresa del mismo
   * tamano que el total se lee como el total, y eso ya no es sugerir.
   *
   * Se imprime la propina sola y la suma final, porque son las dos cosas que
   * el cliente quiere ver: cuanto es el diez por ciento y cuanto le queda
   * pagando si lo deja.
   */
  if (CONFIG.tipPercent > 0) {
    const propina = Math.round((pago.totalCents * CONFIG.tipPercent) / 100);

    parts.push(text(""));
    parts.push(fila(`Propina sugerida (${CONFIG.tipPercent}%)`, money(propina)));

    /*
     * La suma final, del mismo tamano que el total.
     *
     * Salio primero en letra normal para que el numero grande siguiera siendo
     * lo que el cliente debe, y en el papel impreso quedo chico al lado del
     * TOTAL: se leia como una nota al pie justo cuando es lo que el cliente
     * saca la calculadora para averiguar.
     *
     * Que los dos numeros midan lo mismo no los confunde mientras los rotulos
     * no dejen dudas, y son estos dos los que hacen ese trabajo: TOTAL a secas
     * es lo que se debe, CON PROPINA es lo otro. El rotulo va corto a
     * proposito: en letra doble entran la mitad de caracteres, y "TOTAL CON
     * PROPINA" mas el importe no caben en un renglon de 80mm.
     */
    parts.push(CMD.doubleOn, CMD.boldOn);
    parts.push(
      fila(
        "CON PROPINA",
        money(pago.totalCents + propina),
        Math.floor(CONFIG.width / 2),
      ),
    );
    parts.push(CMD.doubleOff, CMD.boldOff);

    // Decirlo es lo correcto y ademas es lo que corresponde: la propina es
    // voluntaria y el papel no puede dar a entender otra cosa.
    parts.push(text("La propina es voluntaria"));
  }

  parts.push(rule("="));
  parts.push(fila("Pago", METODOS[pago.method] ?? pago.method));
  parts.push(fila("Comprobante", pago.code));
  if (pago.cashier) parts.push(fila("Atendio", pago.cashier));

  parts.push(CMD.alignCenter, text(""));
  parts.push(text("Gracias por venir"));

  parts.push(CMD.feed(3), CMD.cut);

  return Buffer.concat(parts);
}

const METODOS = {
  EFECTIVO: "Efectivo",
  DEBITO: "Debito",
  CREDITO: "Credito",
  TRANSFERENCIA: "Transferencia",
  OTRO: "Otro",
};

// --- Impresion ---------------------------------------------------------------

/**
 * ¿La impresora esta en la red o colgada de este PC?
 *
 * Una direccion de red es "192.168.1.50" o "192.168.1.50:9100". Todo lo que
 * lleve una barra es una ruta: /dev/usb/lp0 en Linux, \\localhost\POS80 en
 * Windows. Es la diferencia que hace falta y no obliga a configurar nada mas.
 */
function esRuta(target) {
  return target.includes("/") || target.includes("\\");
}

/**
 * Manda los bytes a la impresora.
 *
 * Por USB se escribe directo al dispositivo: una termica ESC/POS aparece como
 * un archivo al que se le vuelcan los bytes tal cual. En Windows no hay ruta
 * de dispositivo utilizable, asi que se comparte la impresora y se apunta al
 * recurso compartido (\\localhost\NOMBRE), que se abre igual que un archivo.
 */
function print(target, payload) {
  if (esRuta(target)) return writeFile(target, payload);

  const [host, port = "9100"] = target.split(":");

  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      error ? reject(error) : resolve();
    };

    socket.setTimeout(8000);
    socket.on("timeout", () => finish(new Error(`Sin respuesta de ${host}`)));
    socket.on("error", finish);

    socket.connect(Number(port), host, () => {
      socket.write(payload, (error) => {
        if (error) return finish(error);
        // Un corte inmediato puede truncar el buffer de la impresora.
        setTimeout(() => finish(null), 400);
      });
    });
  });
}

// --- Ciclo -------------------------------------------------------------------

async function api(path, init) {
  const response = await fetch(`${CONFIG.url}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CONFIG.token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }

  return response.json();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Como se nombra un papel en el registro de la consola. */
function destinoDe(ticket) {
  return ticket.kind === "COBRO" ? "COBRO" : ticket.station;
}

/** Acuse al servidor: se imprimio, o fallo y por que. */
function acusar(id, ok, error) {
  return api("/api/pos/comandas", {
    method: "POST",
    body: JSON.stringify({ id, ok, ...(error ? { error } : {}) }),
  });
}

/**
 * Junta los papeles que pueden salir en una sola tira.
 *
 * Dos condiciones, las dos necesarias: que sean del mismo envio —el mismo
 * toque de "enviar" del garzon— y que les toque la misma impresora.
 *
 * Lo segundo es lo que deja esto listo para el dia que el local compre la
 * segunda impresora: con PRINTER_BARRA y PRINTER_COCINA configuradas cada
 * mitad resuelve una ranura distinta, la condicion no se cumple, y las
 * comandas vuelven a salir por separado en su propia estacion sin que haya que
 * cambiar ni desactivar nada.
 *
 * El resumen del cobro nunca se junta: no pertenece a un envio, es del cliente.
 */
function agrupar(tickets) {
  const lotes = [];
  const porEnvio = new Map();

  for (const ticket of tickets) {
    const target = printerFor(ticket);
    const clave =
      ticket.kind === "COMANDA" && ticket.batchId
        ? `${ticket.batchId}|${target}`
        : null;

    const abierto = clave ? porEnvio.get(clave) : null;

    if (abierto) {
      abierto.papeles.push(ticket);
      continue;
    }

    const lote = { target, papeles: [ticket] };
    lotes.push(lote);
    if (clave) porEnvio.set(clave, lote);
  }

  return lotes;
}

async function tick() {
  const { tickets } = await api("/api/pos/comandas");

  /** La impresora de la ultima tira que salio, para no encimarle la siguiente. */
  let anterior = null;

  for (const { target, papeles } of agrupar(tickets)) {
    const destino = papeles.map(destinoDe).join("+");
    const numeros = papeles.map((papel) => `#${papel.number}`).join(" ");

    if (!target) {
      for (const papel of papeles) {
        await acusar(papel.id, false, `Sin impresora configurada para ${destinoDe(papel)}`);
      }
      continue;
    }

    // Aire para retirar la tira anterior antes de que salga la siguiente por la
    // misma ranura. Solo entre papeles que de verdad se imprimieron: si el
    // anterior fallo no hay nada sobre la bandeja que esperar. Dentro de una
    // tira no hace falta, que es justamente la gracia: es un solo papel.
    if (anterior === target && CONFIG.gapMs > 0) await sleep(CONFIG.gapMs);

    try {
      await print(target, renderLote(papeles));
      anterior = target;

      for (const papel of papeles) await acusar(papel.id, true);

      console.log(`✓ ${numeros} ${destino} · mesa ${papeles[0].table.number}`);
    } catch (error) {
      console.error(`✗ ${numeros} ${destino}: ${error.message}`);

      for (const papel of papeles) await acusar(papel.id, false, error.message);
    }
  }
}

/**
 * Comanda de prueba, para dejar las impresoras andando antes del servicio.
 *
 *   node scripts/print-agent.mjs --test
 *
 * No toca el servidor: solo imprime. Con --test=render se muestra en pantalla
 * en vez de imprimirse, util para revisar el formato sin gastar papel.
 */
const BASE_PRUEBA = {
  createdAt: new Date().toISOString(),
  table: { number: 1, name: "Prueba de impresion" },
  sessionCode: "M1-TEST",
  waiter: "Prueba",
};

/*
 * Un servicio completo: un envio de mesa y el cobro.
 *
 * Las dos comandas comparten envio a proposito. Con una sola impresora la
 * prueba tiene que salir como sale de verdad —una tira con las dos mitades y
 * la linea de corte en el medio— para poder comprobar con el papel en la mano,
 * antes del servicio, que se parte donde debe y que cada mitad se entiende
 * sola. Con una impresora por estacion la misma prueba saca dos papeles.
 */
const TEST_TICKETS = [
  {
    ...BASE_PRUEBA,
    number: 1,
    kind: "COMANDA",
    station: "COCINA",
    batchId: "envio-de-prueba",
    items: [
      { quantity: 2, name: "Empanadas de queso y aceituna", note: null, diner: "Polera azul" },
      { quantity: 1, name: "Chorrillana clasica", note: "sin cebolla", diner: "Polera azul" },
    ],
  },
  {
    ...BASE_PRUEBA,
    number: 2,
    kind: "COMANDA",
    station: "BARRA",
    batchId: "envio-de-prueba",
    items: [
      { quantity: 3, name: "Cerveza de barril rubia 500cc", note: null, diner: "Poleron gris" },
      { quantity: 1, name: "Pisco sour clasico", note: "sin azucar", diner: null },
    ],
  },
  {
    ...BASE_PRUEBA,
    number: 3,
    kind: "COBRO",
    station: null,
    items: [],
    payment: {
      code: "BZC-PRUEBA",
      paidAt: new Date().toISOString(),
      dinerLabel: null,
      cashier: "Equipo de sala",
      method: "DEBITO",
      subtotalCents: 2980000,
      discountCents: 180000,
      totalCents: 2800000,
      lines: [
        { quantity: 2, name: "Empanadas de queso y aceituna", totalCents: 660000 },
        { quantity: 1, name: "Chorrillana clasica", totalCents: 990000 },
        { quantity: 3, name: "Cerveza de barril rubia 500cc", totalCents: 1150000 },
      ],
    },
  },
];

const testArg = process.argv.find((arg) => arg.startsWith("--test"));

if (testArg) {
  // Se agrupa igual que en el servicio: la prueba tiene que mostrar el mismo
  // reparto de papeles que va a salir esta noche, no uno ideal.
  const lotes = agrupar(TEST_TICKETS);

  if (testArg === "--test=render") {
    for (const { papeles } of lotes) {
      // Se quitan los codigos de control para poder leerlo en la consola.
      const plano = renderLote(papeles)
        .toString("latin1")
        .replace(/[\x00-\x09\x0b-\x1f]/g, "");
      console.log(plano);
    }
    process.exit(0);
  }

  let anterior = null;

  for (const { target, papeles } of lotes) {
    const destino = papeles.map(destinoDe).join("+");

    if (!target) {
      console.error(`✗ ${destino}: sin impresora configurada`);
      process.exitCode = 1;
      continue;
    }

    // Con la misma pausa del servicio: la prueba tiene que salir como saldra
    // de verdad, incluido el tiempo que hay para retirar cada papel.
    if (anterior === target && CONFIG.gapMs > 0) await sleep(CONFIG.gapMs);

    try {
      await print(target, renderLote(papeles));
      anterior = target;
      console.log(`✓ prueba de ${destino} enviada a ${target}`);
    } catch (error) {
      console.error(`✗ ${destino} (${target}): ${error.message}`);
      process.exitCode = 1;
    }
  }

  process.exit(process.exitCode ?? 0);
}

console.log(`Agente de impresion BARZUO → ${CONFIG.url}`);
for (const [destino, target] of Object.entries(CONFIG.printers)) {
  if (!target) continue;
  const via = esRuta(target) ? "USB" : "red";
  console.log(`  ${destino}: ${target} (${via})`);
}
if (CONFIG.gapMs > 0) {
  console.log(`  ${CONFIG.gapMs / 1000}s entre papeles de la misma impresora`);
}
/*
 * Lo que va en el papel del cliente, dicho al arrancar.
 *
 * Es la forma de comprobar en un segundo que este PC esta corriendo la version
 * que uno cree. Cuando el papel sale sin la propina, la causa casi siempre es
 * que el agente del local nunca se actualizo —el cambio vive aca, no en el
 * servidor— y sin esta linea no hay como notarlo sin leer el codigo.
 */
console.log(
  CONFIG.tipPercent > 0
    ? `  propina sugerida del ${CONFIG.tipPercent}% en el papel del cobro`
    : "  sin propina sugerida en el papel del cobro",
);

let corriendo = false;

setInterval(async () => {
  // Una impresora lenta no debe encimar dos ciclos.
  if (corriendo) return;
  corriendo = true;

  try {
    await tick();
  } catch (error) {
    // Se registra y se sigue: perder la red un rato es normal en un bar.
    console.error(`Error consultando la cola: ${error.message}`);
  } finally {
    corriendo = false;
  }
}, CONFIG.intervalMs);
