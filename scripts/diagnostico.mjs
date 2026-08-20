/**
 * Diagnostico de rendimiento, para correr DENTRO del contenedor de la app.
 *
 *   node scripts/diagnostico.mjs
 *
 * Contesta cuatro preguntas que el panel del VPS no puede contestar, porque
 * mira la maquina entera y promediada sobre minutos:
 *
 *   1. ¿El contenedor se reinicio? Un reinicio es, por si solo, motivo de 524.
 *   2. ¿La app contesta rapido AHORA, medida desde adentro?
 *   3. ¿Que esta haciendo Postgres en este momento, y quien espera a quien?
 *   4. ¿Cuanto trabajo de mas hizo la base desde que arranco?
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

console.log(titulo("3. Que esta haciendo Postgres ahora"));

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

console.log(titulo("4. Trabajo de mas acumulado (desde que arranco Postgres)"));

const tablas = await cliente.query(`
  SELECT relname AS tabla, seq_scan, seq_tup_read, idx_scan, n_live_tup
  FROM pg_stat_user_tables
  WHERE relname LIKE 'pos_%' OR relname IN ('redemptions', 'menu_products', 'menu_categories')
  ORDER BY seq_tup_read DESC NULLS LAST
  LIMIT 8
`);

console.log("   tabla                    recorridos    filas leidas   por indice     filas");

for (const fila of tablas.rows) {
  const aviso = Number(fila.seq_tup_read) > 10_000_000 ? "  <--" : "";

  console.log(
    "   " +
      String(fila.tabla).padEnd(24) +
      String(fila.seq_scan).padStart(10) +
      String(fila.seq_tup_read).padStart(16) +
      String(fila.idx_scan ?? 0).padStart(13) +
      String(fila.n_live_tup).padStart(10) +
      aviso,
  );
}

console.log('\n   "recorridos"   = veces que Postgres leyo la tabla entera.');
console.log('   "filas leidas" = filas que tuvo que mirar para descartarlas.');
console.log("   En millones, eso es trabajo tirado a la basura: es exactamente");
console.log("   lo que sacan los indices nuevos.");

await cliente.end();
console.log();
