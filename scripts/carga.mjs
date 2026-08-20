/**
 * Prueba de carga: una noche llena, sin la noche.
 *
 * Simula lo que de verdad hace la app cuando el local esta a tope: mesas
 * abiertas con su consumo, los telefonos de los garzones, la pantalla de la
 * caja, las de cocina y barra, y el agente de impresion preguntando por la
 * cola. Mide cuanto tarda el servidor en contestar mientras todo eso pasa.
 *
 * Se corre DENTRO del contenedor de la app, igual que el diagnostico:
 *
 *   node scripts/carga.mjs                  (30 mesas, 6 garzones, 2 minutos)
 *   node scripts/carga.mjs --mesas 40 --garzones 8 --minutos 5
 *   node scripts/carga.mjs --viejo          (el comportamiento anterior, para comparar)
 *   node scripts/carga.mjs --limpiar        (borrar restos de una prueba cortada)
 *
 * NO imprime nada. Crea mesas abiertas con consumo, pero ninguna comanda: el
 * papel sale al enviar el pedido a la estacion, y eso el simulador no lo hace
 * nunca. Al terminar borra todo lo que creo, tambien si lo cortan con Ctrl-C o
 * si se cierra la terminal. Si aun asi quedaran restos —un corte de luz, un
 * contenedor reiniciado a la fuerza— se limpian con `--limpiar`.
 *
 * Aun asi, escribe en la base a la que apunta: mientras dura, el personal ve
 * mesas de prueba en la sala. Corrélo con el local cerrado.
 */

import { createHmac, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

// --- Argumentos ---------------------------------------------------------------

const args = process.argv.slice(2);

/*
 * Los argumentos se validan de verdad.
 *
 * Un espacio que falta —"--garzones 300--minutos 2"— hacia que el valor fuera
 * "300--minutos", que no es un numero, y la prueba corria con cero garzones
 * informando alegremente que el servidor iba sobrado. Un resultado que miente
 * es peor que ninguno: mejor negarse a arrancar y decir por que.
 */
const opcion = (nombre, defecto) => {
  const i = args.indexOf(`--${nombre}`);
  if (i < 0) return defecto;

  const crudo = args[i + 1];
  const valor = Number(crudo);

  if (crudo === undefined || crudo.startsWith("--")) {
    console.error(`Falta el valor de --${nombre}.`);
    process.exit(1);
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    console.error(`El valor de --${nombre} tiene que ser un numero mayor que cero, y llego "${crudo}".`);

    if (/\d--/.test(crudo)) {
      console.error("Parece que se junto con la opcion siguiente: falta un espacio.");
    }

    process.exit(1);
  }

  return valor;
};

const MESAS = opcion("mesas", 30);
const GARZONES = opcion("garzones", 6);
const MINUTOS = opcion("minutos", 2);
const VIEJO = args.includes("--viejo");
const SOLO_LIMPIAR = args.includes("--limpiar");

const desconocidos = args.filter(
  (arg, i) =>
    arg.startsWith("--") &&
    !["--mesas", "--garzones", "--minutos", "--viejo", "--limpiar"].includes(arg) &&
    // Los valores no empiezan con "--", asi que no se confunden con opciones.
    i >= 0,
);

if (desconocidos.length > 0) {
  console.error(`No entiendo: ${desconocidos.join(" ")}`);
  console.error("Opciones: --mesas N --garzones N --minutos N --viejo --limpiar");
  process.exit(1);
}

/*
 * El generador corre en el mismo servidor que la app y compite con ella. Con
 * muchos garzones el cuello puede pasar a ser el propio simulador, y entonces
 * lo que se mide es su limite y no el de la app.
 */
if (GARZONES > 50) {
  console.warn(`Aviso: ${GARZONES} garzones es mucho mas que cualquier local real.`);
  console.warn("Sirve para buscar el techo, pero si los tiempos se disparan puede");
  console.warn("ser el simulador ahogandose, no la app. Mira el TESTIGO para saberlo.\n");
}

const PUERTO = process.env.PORT ?? 3000;
const BASE = `http://127.0.0.1:${PUERTO}`;
const PREFIJO = "CARGA-";

/*
 * Los dos comportamientos que se comparan.
 *
 * El viejo rearmaba la pantalla entera cada vez. El nuevo pregunta si cambio
 * algo y solo rearma cuando cambio — que en un bar es una de cada muchas
 * vueltas, asi que aca se simula lo que hace la mayoria de las veces.
 */
const RITMO = VIEJO
  ? { sala: 10_000, cuenta: 15_000, estacion: 10_000 }
  : { sala: 5_000, cuenta: 8_000, estacion: 5_000 };

// --- Sesion del panel, firmada a mano -----------------------------------------

/*
 * La imagen de produccion no lleva la libreria de tokens (la usa la app ya
 * empaquetada), asi que el token se firma aca con lo que trae Node. Es el
 * mismo formato que emite el login: HS256, emisor "barzuo", audiencia "panel".
 */
function firmarToken(usuario, secreto) {
  const b64 = (o) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");

  const ahora = Math.floor(Date.now() / 1000);

  const cuerpo = b64({
    userId: usuario.id,
    email: usuario.email,
    name: usuario.name,
    role: usuario.role,
    iat: ahora,
    iss: "barzuo",
    aud: "panel",
    exp: ahora + 3600,
  });

  const cabecera = b64({ alg: "HS256", typ: "JWT" });
  const firma = createHmac("sha256", secreto)
    .update(`${cabecera}.${cuerpo}`)
    .digest("base64url");

  return `${cabecera}.${cuerpo}.${firma}`;
}

// --- Medicion -----------------------------------------------------------------

const muestras = new Map();

function anotar(etiqueta, ms, ok) {
  const actual = muestras.get(etiqueta) ?? { tiempos: [], fallos: 0 };

  actual.tiempos.push(ms);
  if (!ok) actual.fallos += 1;

  muestras.set(etiqueta, actual);
}

async function pedir(etiqueta, url, cookie) {
  const desde = performance.now();

  try {
    const respuesta = await fetch(url, {
      headers: { cookie: `barzuo_panel=${cookie}` },
      cache: "no-store",
    });

    // Se lee el cuerpo entero: si no, no se mide lo que tarda en llegar.
    await respuesta.arrayBuffer();
    anotar(etiqueta, performance.now() - desde, respuesta.ok);
  } catch {
    anotar(etiqueta, performance.now() - desde, false);
  }
}

const percentil = (orden, p) => orden[Math.min(orden.length - 1, Math.floor((orden.length * p) / 100))];

/** CPU consumida por el proceso de la app, para saber cuanto le costo. */
function cpuDeLaApp() {
  try {
    for (const dir of readdirSync("/proc")) {
      if (!/^\d+$/.test(dir)) continue;

      const cmd = readFileSync(`/proc/${dir}/cmdline`, "utf8");
      if (!cmd.includes("server.js") && !cmd.includes("next-server")) continue;

      const campos = readFileSync(`/proc/${dir}/stat`, "utf8").split(") ").pop().split(" ");

      // Campos 14 y 15: tiempo en modo usuario y en modo nucleo, en tics.
      return (Number(campos[11]) + Number(campos[12])) / 100;
    }
  } catch {
    /* Sin acceso a /proc no se mide, y no pasa nada. */
  }

  return null;
}

// --- Escenario ----------------------------------------------------------------

const url = process.env.DATABASE_URL;
const secreto = process.env.AUTH_SECRET;

if (!url || !secreto) {
  console.error("Faltan DATABASE_URL o AUTH_SECRET. Hay que correrlo dentro del contenedor.");
  process.exit(1);
}

const { default: pg } = await import("pg");
const cliente = new pg.Client({ connectionString: url });

await cliente.connect();

const id = () => `c${randomUUID().replace(/-/g, "").slice(0, 24)}`;

async function limpiar() {
  const { rowCount } = await cliente.query(
    `DELETE FROM "pos_table_sessions" WHERE code LIKE $1`,
    [`${PREFIJO}%`],
  );

  // Las mesas de prueba solo existen si el local tenia menos de las pedidas.
  await cliente.query(`DELETE FROM "pos_tables" WHERE number >= 9000`);

  return rowCount;
}

async function preparar() {
  await limpiar();

  const mesas = (
    await cliente.query(
      `SELECT id FROM "pos_tables" WHERE active ORDER BY number LIMIT $1`,
      [MESAS],
    )
  ).rows;

  // Si el local tiene menos mesas que las que se quieren simular, se agregan
  // temporales con numeros altos, que se borran al final.
  for (let i = mesas.length; i < MESAS; i++) {
    const nueva = id();

    await cliente.query(
      `INSERT INTO "pos_tables"(id, number, seats, active, position, "createdAt", "updatedAt")
       VALUES ($1, $2, 4, true, 900, now(), now())`,
      [nueva, 9000 + i],
    );

    mesas.push({ id: nueva });
  }

  const productos = (
    await cliente.query(
      `SELECT p.id, p.name, p."priceCents", coalesce(p.station, c.station) AS station
       FROM "menu_products" p JOIN "menu_categories" c ON c.id = p."categoryId"
       WHERE p.available AND c.active LIMIT 40`,
    )
  ).rows;

  if (productos.length === 0) {
    console.error("No hay productos disponibles en la carta: no puedo simular consumo.");
    process.exit(1);
  }

  const sesiones = [];

  for (const [i, mesa] of mesas.entries()) {
    const sesion = id();

    await cliente.query(
      `INSERT INTO "pos_table_sessions"(id, "tableId", code, status, guests, "openedAt", "updatedAt")
       VALUES ($1, $2, $3, 'OPEN', $4, now(), now())`,
      [sesion, mesa.id, `${PREFIJO}${i}-${randomUUID().slice(0, 4)}`, 2 + (i % 5)],
    );

    // Dos o tres comensales por mesa, que es lo que parte la cuenta en pestañas.
    const comensales = [];

    for (let d = 0; d < 2 + (i % 2); d++) {
      const comensal = id();

      await cliente.query(
        `INSERT INTO "pos_diners"(id, "sessionId", label, position, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, now(), now())`,
        [comensal, sesion, `Comensal ${d + 1}`, d],
      );

      comensales.push(comensal);
    }

    /*
     * Consumo ya cargado. La mayoria en SENT —lo que ya salio a la estacion—
     * y algunas en DRAFT, que es como esta una mesa a media noche.
     *
     * Sin comandas asociadas a proposito: la comanda es lo que imprime, y esto
     * no puede imprimir nada.
     */
    for (let l = 0; l < 6 + (i % 8); l++) {
      const producto = productos[(i + l) % productos.length];

      await cliente.query(
        `INSERT INTO "pos_order_items"
           (id, "sessionId", "dinerId", "productId", name, "unitPriceCents", quantity,
            "discountCents", courtesy, station, status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, false, $8, $9, now(), now())`,
        [
          id(),
          sesion,
          l % 3 === 0 ? null : comensales[l % comensales.length],
          producto.id,
          producto.name,
          producto.priceCents,
          1 + (l % 3),
          producto.station,
          l % 5 === 0 ? "DRAFT" : "SENT",
        ],
      );
    }

    sesiones.push(sesion);
  }

  return sesiones;
}

// --- Actores ------------------------------------------------------------------

let corriendo = true;

const dormir = (ms) => new Promise((listo) => setTimeout(listo, ms));

/** Repite algo a un ritmo fijo, hasta que se acabe la prueba. */
async function cada(ms, tarea) {
  // Arranque escalonado: seis pantallas encendidas no laten todas a la vez.
  await dormir(Math.random() * ms);

  while (corriendo) {
    await tarea();
    await dormir(ms);
  }
}

async function simular(sesiones, cookie) {
  const tareas = [];

  for (let g = 0; g < GARZONES; g++) {
    const sesion = sesiones[g % sesiones.length];

    if (VIEJO) {
      // Antes cada vuelta rearmaba la pantalla entera, cambiara algo o no.
      tareas.push(cada(RITMO.sala, () => pedir("sala (pagina entera)", `${BASE}/staff/pos`, cookie)));
      tareas.push(
        cada(RITMO.cuenta, () =>
          pedir("cuenta (pagina entera)", `${BASE}/staff/pos/${sesion}`, cookie),
        ),
      );
    } else {
      tareas.push(
        cada(RITMO.sala, () => pedir("sala (sondeo)", `${BASE}/api/pos/version?scope=sala`, cookie)),
      );
      tareas.push(
        cada(RITMO.cuenta, () =>
          pedir("cuenta (sondeo)", `${BASE}/api/pos/version?scope=cuenta&sesion=${sesion}`, cookie),
        ),
      );

      // Y de vez en cuando el garzon efectivamente abre una cuenta.
      tareas.push(
        cada(45_000, () =>
          pedir(
            "cuenta (abrir de verdad)",
            `${BASE}/staff/pos/${sesiones[Math.floor(Math.random() * sesiones.length)]}`,
            cookie,
          ),
        ),
      );
    }
  }

  for (const estacion of ["COCINA", "BARRA"]) {
    tareas.push(
      cada(RITMO.estacion, () =>
        VIEJO
          ? pedir(
              "estacion (pagina entera)",
              `${BASE}/staff/${estacion === "COCINA" ? "cocina" : "barra"}`,
              cookie,
            )
          : pedir(
              "estacion (sondeo)",
              `${BASE}/api/pos/version?scope=estacion&estacion=${estacion}`,
              cookie,
            ),
      ),
    );
  }

  // El agente de impresion pregunta por la cola cada cuatro segundos.
  const tokenAgente = process.env.PRINT_AGENT_TOKEN;

  if (tokenAgente) {
    tareas.push(
      cada(4_000, async () => {
        const desde = performance.now();

        try {
          const r = await fetch(`${BASE}/api/pos/comandas`, {
            headers: { authorization: `Bearer ${tokenAgente}` },
            cache: "no-store",
          });

          await r.arrayBuffer();
          anotar("cola de impresion", performance.now() - desde, r.ok);
        } catch {
          anotar("cola de impresion", performance.now() - desde, false);
        }
      }),
    );
  }

  // El testigo: algo que no hace nada. Lo que tarde es cola pura.
  tareas.push(
    cada(1_000, async () => {
      const desde = performance.now();

      try {
        const r = await fetch(`${BASE}/api/health`, { cache: "no-store" });
        await r.arrayBuffer();
        anotar("TESTIGO /api/health", performance.now() - desde, r.ok);
      } catch {
        anotar("TESTIGO /api/health", performance.now() - desde, false);
      }
    }),
  );

  await dormir(MINUTOS * 60_000);
  corriendo = false;
  await Promise.allSettled(tareas);
}

// --- Salida -------------------------------------------------------------------

function informe(cpuGastada) {
  console.log(`\nResultados (${MINUTOS} min, ${MESAS} mesas, ${GARZONES} garzones, modo ${VIEJO ? "VIEJO" : "NUEVO"})`);
  console.log("-".repeat(78));
  console.log("   que se pidio                    veces   mediana      p95     peor   fallos");

  for (const [etiqueta, datos] of muestras) {
    const orden = [...datos.tiempos].sort((a, b) => a - b);

    console.log(
      "   " +
        etiqueta.padEnd(30) +
        String(orden.length).padStart(6) +
        `${percentil(orden, 50).toFixed(0)} ms`.padStart(10) +
        `${percentil(orden, 95).toFixed(0)} ms`.padStart(9) +
        `${orden[orden.length - 1].toFixed(0)} ms`.padStart(9) +
        String(datos.fallos).padStart(9),
    );
  }

  /*
   * Los fallos se miran ANTES que los tiempos.
   *
   * Un pedido que no llega vuelve rapidisimo, asi que con la app caida los
   * tiempos dan preciosos y el veredicto diria "va sobrado" — justo cuando
   * todo esta roto. Primero hay que saber si las respuestas eran de verdad.
   */
  let pedidos = 0;
  let fallos = 0;

  for (const datos of muestras.values()) {
    pedidos += datos.tiempos.length;
    fallos += datos.fallos;
  }

  if (fallos > 0) {
    const porcentaje = (fallos / pedidos) * 100;

    console.log(`\n   ATENCION: ${fallos} de ${pedidos} pedidos fallaron (${porcentaje.toFixed(0)}%).`);

    if (porcentaje > 20) {
      console.log("   Con esa proporcion los tiempos de arriba no significan nada: un");
      console.log("   pedido que no llega vuelve rapido. Revisa que la app este arriba,");
      console.log("   que el puerto sea el correcto y que la sesion no este vencida.");
      return;
    }

    console.log("   Fallos sueltos bajo carga ya son sintoma: el servidor rechaza en vez");
    console.log("   de encolar. Es el escalon anterior al 524.");
  }

  const testigo = muestras.get("TESTIGO /api/health");

  if (testigo) {
    const orden = [...testigo.tiempos].sort((a, b) => a - b);
    const p95 = percentil(orden, 95);

    console.log("\n   El TESTIGO solo hace SELECT 1: es la fila de espera pura.");

    if (p95 < 50) console.log(`   ${p95.toFixed(0)} ms en el p95: el servidor va sobrado con esta carga.`);
    else if (p95 < 300) console.log(`   ${p95.toFixed(0)} ms en el p95: aguanta, pero ya se nota la cola.`);
    else console.log(`   ${p95.toFixed(0)} ms en el p95: hay cola de verdad. Con mas carga, esto es un 524.`);
  }

  if (cpuGastada !== null) {
    const nucleos = readFileSync("/proc/cpuinfo", "utf8").split("processor").length - 1;
    const uso = (cpuGastada / (MINUTOS * 60)) * 100;

    console.log(`\n   La app gasto ${uso.toFixed(0)}% de un nucleo durante la prueba.`);
    console.log(`   El servidor tiene ${nucleos}: en un panel eso se veria como ${(uso / nucleos).toFixed(0)}% de CPU.`);
    console.log("   Por eso un panel tranquilo no descarta que la app este ahogada.");
  }
}

// --- Ejecucion ----------------------------------------------------------------

let sesiones = [];

async function terminar() {
  corriendo = false;
  const borradas = await limpiar().catch(() => 0);
  console.log(`\nLimpieza: ${borradas} mesas de prueba borradas.`);
  await cliente.end().catch(() => {});
}

/*
 * Tambien hay que limpiar cuando cierran la terminal.
 *
 * Pasó: se cerro el contenedor de la terminal a mitad de una prueba y quedaron
 * cuarenta mesas falsas abiertas en la sala. Al cerrar una terminal el proceso
 * recibe SIGHUP, y sin atenderlo Node se muere en el acto sin pasar por la
 * limpieza. SIGTERM es lo que manda Docker al parar el contenedor.
 *
 * Con SIGKILL no hay nada que hacer —no se puede atender—, y para eso esta
 * `--limpiar`.
 */
for (const señal of ["SIGINT", "SIGHUP", "SIGTERM"]) {
  process.on(señal, async () => {
    console.log(`\nInterrumpido (${señal}).`);
    await terminar();
    process.exit(0);
  });
}

if (SOLO_LIMPIAR) {
  const borradas = await limpiar();

  console.log(
    borradas > 0
      ? `Listo: ${borradas} mesas de prueba borradas.`
      : "No habia nada que limpiar: ninguna mesa de prueba en la base.",
  );

  await cliente.end();
  process.exit(0);
}

const usuario = (
  await cliente.query(
    `SELECT id, email, name, role FROM users WHERE active ORDER BY role LIMIT 1`,
  )
).rows[0];

if (!usuario) {
  console.error("No hay ningun usuario activo con el que entrar al panel.");
  process.exit(1);
}

const cookie = firmarToken(usuario, secreto);

/*
 * Pase lo que pase, se limpia.
 *
 * Si esto reventara a mitad de camino, el personal se encontraria treinta
 * mesas falsas abiertas en la sala y sin saber de donde salieron. La limpieza
 * va en `finally` por eso, no por prolijidad.
 */
try {
  console.log(`Preparando ${MESAS} mesas abiertas con consumo (sin comandas: no imprime nada)...`);
  sesiones = await preparar();
  console.log(`Listo. Simulando ${MINUTOS} minuto(s) de servicio con ${GARZONES} garzones, cocina, barra y caja.\n`);

  const cpuAntes = cpuDeLaApp();

  await simular(sesiones, cookie);

  const cpuDespues = cpuDeLaApp();

  informe(cpuAntes !== null && cpuDespues !== null ? cpuDespues - cpuAntes : null);
} catch (error) {
  console.error(`\nLa prueba fallo: ${error.message}`);
  process.exitCode = 1;
} finally {
  await terminar();
}
