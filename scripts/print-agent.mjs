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

import { Socket } from "node:net";

const CONFIG = {
  url: (process.env.BARZUO_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  token: process.env.PRINT_AGENT_TOKEN ?? "",
  intervalMs: Number(process.env.PRINT_POLL_MS ?? 4000),
  printers: {
    COCINA: process.env.PRINTER_COCINA ?? "",
    BARRA: process.env.PRINTER_BARRA ?? "",
  },
  /** Ancho del papel en caracteres. 48 = 80mm, 32 = 58mm. */
  width: Number(process.env.PRINT_WIDTH ?? 48),
};

if (!CONFIG.token) {
  console.error("Falta PRINT_AGENT_TOKEN (el mismo que en el servidor).");
  process.exit(1);
}

if (!CONFIG.printers.COCINA && !CONFIG.printers.BARRA) {
  console.error("Configura al menos PRINTER_COCINA o PRINTER_BARRA.");
  process.exit(1);
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

/** Arma el ticket completo tal como sale por la impresora. */
function renderTicket(ticket) {
  const parts = [CMD.init, CMD.codepage, CMD.beep, CMD.alignCenter];

  parts.push(CMD.doubleOn, CMD.boldOn);
  parts.push(text(ticket.stationLabel.toUpperCase()));
  parts.push(CMD.doubleOff);
  parts.push(text(`MESA ${ticket.table.number}`));
  parts.push(CMD.boldOff);

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

// --- Impresion ---------------------------------------------------------------

/** Manda los bytes a una termica de red. Resuelve cuando se vaciaron. */
function print(target, payload) {
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
    const target = CONFIG.printers[ticket.station];

    if (!target) {
      await api("/api/pos/comandas", {
        method: "POST",
        body: JSON.stringify({
          id: ticket.id,
          ok: false,
          error: `Sin impresora configurada para ${ticket.station}`,
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
      console.log(`✓ #${ticket.number} ${ticket.station} · mesa ${ticket.table.number}`);
    } catch (error) {
      console.error(`✗ #${ticket.number} ${ticket.station}: ${error.message}`);
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
const TEST_TICKET = {
  number: 0,
  station: "COCINA",
  stationLabel: "Prueba",
  createdAt: new Date().toISOString(),
  table: { number: 1, name: "Comanda de prueba" },
  sessionCode: "M1-TEST",
  items: [
    { quantity: 2, name: "Empanadas de queso y aceituna", note: null, diner: "Polera azul" },
    { quantity: 1, name: "Chorrillana clasica", note: "sin cebolla", diner: "Polera azul" },
    { quantity: 3, name: "Cerveza de barril rubia 500cc", note: null, diner: "Poleron gris" },
  ],
};

const testArg = process.argv.find((arg) => arg.startsWith("--test"));

if (testArg) {
  const payload = renderTicket(TEST_TICKET);

  if (testArg === "--test=render") {
    // Se quitan los codigos de control para poder leerlo en la consola.
    console.log(payload.toString("latin1").replace(/[\x00-\x09\x0b-\x1f]/g, ""));
    process.exit(0);
  }

  const targets = Object.entries(CONFIG.printers).filter(([, value]) => value);

  await Promise.all(
    targets.map(async ([station, target]) => {
      try {
        await print(target, payload);
        console.log(`✓ prueba enviada a ${station} (${target})`);
      } catch (error) {
        console.error(`✗ ${station} (${target}): ${error.message}`);
        process.exitCode = 1;
      }
    }),
  );

  process.exit(process.exitCode ?? 0);
}

console.log(`Agente de impresion BARZUO → ${CONFIG.url}`);
for (const [station, target] of Object.entries(CONFIG.printers)) {
  if (target) console.log(`  ${station}: ${target}`);
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
