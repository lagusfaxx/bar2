/**
 * Diagnostico de rendimiento, para correr DENTRO del contenedor de la app.
 *
 *   node scripts/diagnostico.mjs
 *
 * Contesta lo que el panel del VPS no puede, porque mira la maquina entera y
 * promediada sobre minutos:
 *
 *   1. ¿Se reinicio la app? ¿Falta procesador o el cuello es el disco?
 *   2. ¿La app contesta rapido AHORA, medida desde adentro?
 *   3. ¿Se aplicaron las migraciones de indices?
 *   4. ¿Que esta haciendo Postgres en este momento, y quien espera a quien?
 *   5. ¿Cuanto trabajo de mas hizo la base desde que arranco?
 *
 * Conviene correrlo EN PLENO SERVICIO, con las pantallas encendidas: en un
 * local vacio, o recien desplegado, todos los numeros dan bien.
 *
 * Solo lee: no modifica ni una fila.
 */

import { cpus } from "node:os";
import { readFileSync } from "node:fs";

const titulo = (t) => `\n${t}\n${"-".repeat(t.length)}`;
const duracion = (s) =>
  `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

// --- 1. ¿Hace cuanto vive esto? ---------------------------------------------

console.log(titulo("1. Contenedor y servidor"));

try {
  /*
   * Cuidado con /proc/uptime a secas: dentro de un contenedor es el del
   * SERVIDOR, no el del contenedor, asi que no dice nada sobre reinicios de la
   * app. Lo que si lo dice es la edad del proceso 1, que nace y muere con el
   * contenedor. Se calcula restandole a la marcha del servidor el momento en
   * que ese proceso arranco (campo 22 de /proc/1/stat, en tics de reloj).
   */
  const servidor = Number(readFileSync("/proc/uptime", "utf8").split(" ")[0]);

  // El nombre del proceso puede traer espacios y parentesis: se corta despues.
  const campos = readFileSync("/proc/1/stat", "utf8").split(") ").pop().split(" ");
  const arranco = Number(campos[19]) / 100; // campo 22, menos los dos recortados

  const edad = servidor - arranco;

  console.log(`   La app lleva encendida: ${duracion(edad)}`);
  console.log(`   El servidor lleva encendido: ${duracion(servidor)}`);

  if (edad < 3600) {
    console.log("   AVISO: menos de una hora. Si no desplegaste recien, se reinicio solo,");
    console.log("          y un reinicio explica un 524 sin necesidad de nada mas.");
  }

  const [c1, c5, c15] = readFileSync("/proc/loadavg", "utf8").split(" ");
  const nucleos = cpus().length;

  console.log(`   Carga: ${c1} (1 min) - ${c5} (5 min) - ${c15} (15 min), con ${nucleos} nucleos`);
  console.log(`   Por encima de ${nucleos} hay trabajo esperando turno.`);

  if (Number(c1) > nucleos) {
    console.log("   AVISO: hay cola en este momento.");
  }
} catch (error) {
  console.log(`   No pude leerlo: ${error.message}`);
}

/*
 * Carga alta con CPU baja no es una contradiccion: en Linux la carga cuenta
 * tambien lo que espera al disco. Separarlo es la diferencia entre "falta
 * procesador" y "el disco no da abasto", que se arreglan de maneras opuestas.
 */
try {
  const cpu = () => {
    const linea = readFileSync("/proc/stat", "utf8").split("\n")[0].split(/\s+/).slice(1);
    const n = linea.map(Number);

    return { total: n.reduce((a, b) => a + b, 0), ocupado: n[0] + n[1] + n[2], espera: n[4] };
  };

  const antes = cpu();
  await new Promise((listo) => setTimeout(listo, 1000));
  const ahora = cpu();

  const total = ahora.total - antes.total;
  const trabajando = ((ahora.ocupado - antes.ocupado) / total) * 100;
  const esperandoDisco = ((ahora.espera - antes.espera) / total) * 100;

  console.log(`   En este segundo: ${trabajando.toFixed(0)}% calculando, ${esperandoDisco.toFixed(0)}% esperando al disco`);

  if (esperandoDisco > 10) {
    console.log("   AVISO: el disco es el cuello, no el procesador. Eso sube la carga");
    console.log("          dejando la CPU baja, y hace lento todo lo que toque la base.");
  }
} catch (error) {
  console.log(`   No pude medir el reparto de CPU: ${error.message}`);
}

// --- 2. ¿Cuanto tarda la app en contestar? ------------------------------------

console.log(titulo("2. Respuesta de la app (20 pedidos a /api/health)"));

const puerto = process.env.PORT ?? 3000;
const tiempos = [];

for (let i = 0; i < 20; i++) {
  const desde = performance.now();

  try {
    await fetch(`http://127.0.0.1:${puerto}/api/health`, { cache: "no-store" });
    tiempos.push(performance.now() - desde);
  } catch (error) {
    console.log(`   El pedido ${i + 1} fallo: ${error.message}`);
  }
}

if (tiempos.length > 0) {
  const orden = [...tiempos].sort((a, b) => a - b);
  const mediana = orden[Math.floor(orden.length / 2)];
  const peor = orden[orden.length - 1];

  console.log(`   Mediana: ${mediana.toFixed(0)} ms - Peor: ${peor.toFixed(0)} ms`);
  console.log("   Esa ruta solo hace SELECT 1. Todo lo que pase de unos pocos");
  console.log("   milisegundos es cola, no trabajo.");

  if (peor > 500) {
    console.log(`   AVISO: ${peor.toFixed(0)} ms para no hacer nada. El hilo de la app`);
    console.log("          estaba ocupado con otra cosa cuando llego el pedido.");
  }
}

// --- 3 y 4. La base de datos --------------------------------------------------

const url = process.env.DATABASE_URL;

if (!url) {
  console.log(titulo("3. Base de datos"));
  console.log("   Este proceso no tiene DATABASE_URL: no puedo consultarla.");
  process.exit(0);
}

const { default: pg } = await import("pg");
const cliente = new pg.Client({ connectionString: url });

await cliente.connect();

console.log(titulo("3. ¿Llegaron los indices nuevos?"));

const esperados = [
  ["pos_order_items_ticketId_idx", "lineas de una comanda (pantallas de cocina y barra)"],
  ["pos_order_items_createdAt_idx", "ranking de lo mas vendido"],
  ["pos_order_items_updatedAt_idx", "sondeo de cambios"],
  ["pos_order_tickets_status_number_idx", "cola de impresion"],
  ["pos_order_tickets_updatedAt_idx", "sondeo de cambios"],
  ["pos_table_sessions_updatedAt_idx", "sondeo de cambios"],
];

const presentes = new Set(
  (
    await cliente.query(
      "SELECT indexname FROM pg_indexes WHERE indexname = ANY($1)",
      [esperados.map(([nombre]) => nombre)],
    )
  ).rows.map((fila) => fila.indexname),
);

for (const [nombre, para] of esperados) {
  console.log(`   ${presentes.has(nombre) ? "si" : "NO"}  ${nombre.padEnd(38)} ${para}`);
}

if (presentes.size < esperados.length) {
  console.log("   AVISO: falta alguno. La migracion no se aplico: revisa el log de arranque");
  console.log("          del contenedor, donde corre 'prisma migrate deploy'.");
}

console.log(titulo("4. Que esta haciendo Postgres ahora"));

const actividad = await cliente.query(`
  SELECT state,
         wait_event_type,
         count(*)::int AS n,
         round(max(extract(epoch FROM now() - query_start))::numeric, 1) AS mas_vieja
  FROM pg_stat_activity
  WHERE datname = current_database() AND pid <> pg_backend_pid()
  GROUP BY 1, 2
  ORDER BY n DESC
`);

if (actividad.rows.length === 0) {
  console.log("   Nadie conectado, ademas de este diagnostico.");
}

for (const fila of actividad.rows) {
  const estado = String(fila.state ?? "?").padEnd(20);
  const espera = String(fila.wait_event_type ?? "-").padEnd(12);

  console.log(`   ${estado} espera:${espera} ${fila.n} conexion(es), la mas vieja ${fila.mas_vieja}s`);
}

console.log("   El pool de la app son 10 conexiones (DATABASE_POOL_MAX).");
console.log("   Si aparecen 10 ocupadas, el resto de los pedidos hace fila.");

const enCurso = await cliente.query(`
  SELECT round(extract(epoch FROM now() - query_start)::numeric, 1) AS seg,
         left(regexp_replace(query, '\\s+', ' ', 'g'), 110) AS consulta
  FROM pg_stat_activity
  WHERE datname = current_database() AND state = 'active' AND pid <> pg_backend_pid()
  ORDER BY query_start
  LIMIT 5
`);

if (enCurso.rows.length > 0) {
  console.log("\n   Consultas en curso, de la mas vieja a la mas nueva:");

  for (const fila of enCurso.rows) {
    console.log(`   ${String(fila.seg).padStart(6)}s  ${fila.consulta}`);
  }
}

console.log(titulo("5. Trabajo de la base, medido en vivo (15 segundos)"));

/*
 * Aca hubo una leccion, aprendida mirando una salida real.
 *
 * La primera version mostraba los totales desde que arranco Postgres y
 * marcaba como sospechosa cualquier tabla muy recorrida. En una base con
 * ciento y pico de filas eso asusta sin motivo: cuando una tabla entra en una
 * sola pagina de disco, Postgres elige leerla entera A PROPOSITO, porque es
 * mas rapido que abrir un indice. Miles de "recorridos" ahi no son un
 * problema, son la decision correcta.
 *
 * Lo que si importa es el ritmo: cuanto trabajo esta haciendo AHORA, mientras
 * el local atiende. Por eso se mide una ventana y se compara, en vez de
 * mostrar un acumulado de semanas que nadie sabe con que comparar.
 */
const VENTANA_SEG = 15;

const medir = async () =>
  new Map(
    (
      await cliente.query(`
        SELECT relname AS tabla, seq_scan, seq_tup_read, idx_scan, n_live_tup
        FROM pg_stat_user_tables
        WHERE relname LIKE 'pos_%' OR relname IN ('redemptions', 'menu_products', 'menu_categories')
      `)
    ).rows.map((fila) => [fila.tabla, fila]),
  );

const antesDb = await medir();
console.log(`   Midiendo ${VENTANA_SEG} segundos de actividad real...`);
await new Promise((listo) => setTimeout(listo, VENTANA_SEG * 1000));
const despuesDb = await medir();

const filas = [...despuesDb.values()]
  .map((fila) => {
    const previa = antesDb.get(fila.tabla);

    return {
      tabla: fila.tabla,
      filasTabla: Number(fila.n_live_tup),
      recorridos: Number(fila.seq_scan) - Number(previa?.seq_scan ?? 0),
      leidas: Number(fila.seq_tup_read) - Number(previa?.seq_tup_read ?? 0),
      porIndice: Number(fila.idx_scan ?? 0) - Number(previa?.idx_scan ?? 0),
    };
  })
  .sort((a, b) => b.leidas - a.leidas)
  .slice(0, 8);

console.log("   tabla                    recorridos    filas leidas   por indice     filas");

for (const fila of filas) {
  // Por debajo de esto, leer la tabla entera es lo correcto y no cuesta nada.
  const chica = fila.filasTabla < 5000;
  const nota = fila.leidas > 500_000 ? "  <-- MIRAR" : chica ? "  (tabla chica)" : "";

  console.log(
    "   " +
      String(fila.tabla).padEnd(24) +
      String(fila.recorridos).padStart(10) +
      String(fila.leidas).padStart(16) +
      String(fila.porIndice).padStart(13) +
      String(fila.filasTabla).padStart(10) +
      nota,
  );
}

const totalLeidas = filas.reduce((suma, fila) => suma + fila.leidas, 0);

console.log(`\n   En ${VENTANA_SEG} segundos la base miro ${totalLeidas.toLocaleString("es-CL")} filas.`);
console.log("   Con el local vacio deberia ser casi cero. En pleno servicio, unos");
console.log("   pocos miles. Cientos de miles significa trabajo repetido: ahi si");
console.log("   faltan indices, o alguien esta pidiendo la misma vista sin parar.");
console.log('   "(tabla chica)" = cabe en una pagina; leerla entera es lo correcto.');

await cliente.end();
console.log();
