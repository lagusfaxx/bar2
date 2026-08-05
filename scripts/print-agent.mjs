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
 * Uso:
 *   BARZUO_URL=https://barzuo.com \
 *   PRINT_AGENT_TOKEN=... \
 *   PRINTER_COCINA=192.168.1.50 \
 *   PRINTER_BARRA=192.168.1.51 \
 *   node scripts/print-agent.mjs
 *
 * No necesita instalar nada: solo Node 18 o superior.
 */

import { writeFile } from "node:fs/promises";
import { Socket } from "node:net";

const CONFIG = {
  url: (process.env.BARZUO_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  token: process.env.PRINT_AGENT_TOKEN ?? "",
  intervalMs: Number(process.env.PRINT_POLL_MS ?? 4000),
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
  width: Number(process.env.PRINT_WIDTH ?? 48),
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

/** Arma el ticket completo tal como sale por la impresora. */
function renderTicket(ticket) {
  if (ticket.kind === "COBRO") return renderCobro(ticket);

  const parts = [CMD.init, CMD.codepage, CMD.beep];

  parts.push(...encabezado(ticket.station));

  parts.push(CMD.alignCenter, CMD.doubleOn, CMD.boldOn);
  parts.push(text(`MESA ${ticket.table.number}`));
  parts.push(CMD.doubleOff, CMD.boldOff);

  if (ticket.table.name) parts.push(text(ticket.table.name));

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

async function tick() {
  const { tickets } = await api("/api/pos/comandas");

  for (const ticket of tickets) {
    const destino = ticket.kind === "COBRO" ? "COBRO" : ticket.station;
    const target = printerFor(ticket);

    if (!target) {
      await api("/api/pos/comandas", {
        method: "POST",
        body: JSON.stringify({
          id: ticket.id,
          ok: false,
          error: `Sin impresora configurada para ${destino}`,
        }),
      });
      continue;
    }

    try {
      await print(target, renderTicket(ticket));
      await api("/api/pos/comandas", {
        method: "POST",
        body: JSON.stringify({ id: ticket.id, ok: true }),
      });
      console.log(`✓ #${ticket.number} ${destino} · mesa ${ticket.table.number}`);
    } catch (error) {
      console.error(`✗ #${ticket.number} ${destino}: ${error.message}`);
      await api("/api/pos/comandas", {
        method: "POST",
        body: JSON.stringify({ id: ticket.id, ok: false, error: error.message }),
      });
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
};

/*
 * Los tres papeles que salen en un servicio.
 *
 * La prueba los imprime los tres seguidos justamente para lo que importa aca:
 * comprobar, con los papeles en la mano, que se distinguen entre si antes de
 * que empiece el servicio y no en medio de el.
 */
const TEST_TICKETS = [
  {
    ...BASE_PRUEBA,
    number: 1,
    kind: "COMANDA",
    station: "COCINA",
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
  if (testArg === "--test=render") {
    for (const ticket of TEST_TICKETS) {
      // Se quitan los codigos de control para poder leerlo en la consola.
      const plano = renderTicket(ticket)
        .toString("latin1")
        .replace(/[\x00-\x09\x0b-\x1f]/g, "");
      console.log(plano);
    }
    process.exit(0);
  }

  for (const ticket of TEST_TICKETS) {
    const destino = ticket.kind === "COBRO" ? "COBRO" : ticket.station;
    const target = printerFor(ticket);

    if (!target) {
      console.error(`✗ ${destino}: sin impresora configurada`);
      process.exitCode = 1;
      continue;
    }

    try {
      await print(target, renderTicket(ticket));
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
