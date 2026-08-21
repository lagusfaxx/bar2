/**
 * Busqueda de la carta, pensada para un mostrador sin teclado.
 *
 * En el POS del local no hay teclado fisico y el garzon escribe con el dedo,
 * de pie, con gente esperando. Cada letra cuesta, asi que la busqueda tiene
 * que acertar con lo poco que alcance a escribir y perdonar lo que escriba
 * mal: "cerv", "sxhop", "PISCOLA", "jugo natural" y "natural jugo" tienen que
 * llegar todos al mismo producto.
 *
 * Por eso no alcanza con `includes()`. Lo que hace este modulo es:
 *
 * 1. Aplanar el texto: sin tildes, sin mayusculas, sin puntuacion. En Chile
 *    nadie va a escribir "Piscola con Limon" con su tilde en un tactil.
 * 2. Partir en palabras y exigir que *todas* las escritas aparezcan, en
 *    cualquier orden. Escribir mas siempre acota; nunca sorprende con menos.
 * 3. Puntuar cada coincidencia segun que tan buena es —palabra exacta, empieza
 *    con, contiene, o una letra de diferencia— para que lo mejor quede arriba.
 *
 * Es texto puro y sin dependencias: corre igual en el servidor y en el
 * navegador, y se puede probar sola.
 */

/**
 * Deja el texto en su forma comparable.
 *
 * Descompone los acentos y los borra (NFD + rango de diacriticos), pasa a
 * minusculas y convierte cualquier cosa que no sea letra o numero en un
 * espacio: asi "Piscola 1/2 Litro" y "piscola 1 2 litro" son lo mismo.
 */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Las palabras del texto, ya aplanadas. */
export function tokenize(text: string): string[] {
  const flat = normalize(text);
  return flat ? flat.split(" ") : [];
}

/**
 * ¿Son la misma palabra con un error de tipeo?
 *
 * Distancia de edicion con tope en 1 (una letra cambiada, sobrante o
 * faltante). Se corta apenas se pasa: son palabras cortas y esto corre en cada
 * tecla sobre toda la carta.
 *
 * El tope es uno a proposito. Con dos, "vino" empieza a encontrar "vaso" y la
 * lista se llena de cosas que el garzon no pidio — que en un POS es peor que
 * no encontrar nada, porque se carga el producto equivocado.
 */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;

  const diff = a.length - b.length;
  if (diff > 1 || diff < -1) return false;

  // Misma longitud: alcanza con que difieran en una sola posicion.
  if (diff === 0) {
    let errors = 0;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i] && (errors += 1) > 1) return false;
    }
    return errors === 1;
  }

  // Distinta longitud: la larga tiene una letra de mas en algun lugar.
  const [long, short] = diff === 1 ? [a, b] : [b, a];

  let i = 0;
  let j = 0;
  let skipped = false;

  while (i < long.length && j < short.length) {
    if (long[i] === short[j]) {
      i += 1;
      j += 1;
      continue;
    }
    if (skipped) return false;
    skipped = true;
    i += 1;
  }

  return true;
}

/* Cuanto vale cada tipo de coincidencia. Ordenadas de mejor a peor. */
const EXACTA = 100;
const EMPIEZA = 70;
const CONTIENE = 40;
const TIPEO = 20;

/** Largo minimo para aceptar coincidencias flojas: debajo de esto, todo pega. */
const MIN_CONTIENE = 3;
const MIN_TIPEO = 4;

/**
 * Que tan bien una palabra escrita le pega a otra de la carta.
 *
 * Cero significa que no le pega y descarta el producto entero.
 */
function scoreWord(haystack: string, needle: string, perdonarTipeo = true): number {
  if (haystack === needle) return EXACTA;
  if (haystack.startsWith(needle)) return EMPIEZA;
  if (needle.length >= MIN_CONTIENE && haystack.includes(needle)) return CONTIENE;
  if (perdonarTipeo && needle.length >= MIN_TIPEO && withinOneEdit(haystack, needle)) {
    return TIPEO;
  }
  return 0;
}

/**
 * Puntua un producto contra lo escrito.
 *
 * Devuelve `null` si alguna de las palabras escritas no aparece por ningun
 * lado: el filtro es "y", no "o". El nombre pesa mas que la categoria —quien
 * escribe "schop" busca el schop, no la seccion Cervezas— pero la categoria
 * cuenta, y bastante: en un bar la primera palabra que sale es la generica
 * ("cerveza", "trago", "postre") y esa casi nunca esta en el nombre del
 * producto.
 */
export function scoreEntry(
  entry: { name: string; category?: string | null },
  needles: string[],
): number | null {
  if (needles.length === 0) return 0;

  const nameWords = tokenize(entry.name);
  const categoryWords = entry.category ? tokenize(entry.category) : [];

  let total = 0;

  for (const needle of needles) {
    let best = 0;

    for (const word of nameWords) {
      const score = scoreWord(word, needle);
      if (score > best) best = score;
    }

    /*
     * La categoria vale la mitad: ubica, pero no es lo que se pidio. Y no
     * perdona el tipeo, que ahi es puro ruido: "papa" a una letra de "para"
     * arrastraria la seccion "Para picar" entera a los resultados.
     */
    for (const word of categoryWords) {
      const score = scoreWord(word, needle, false) / 2;
      if (score > best) best = score;
    }

    if (best === 0) return null;
    total += best;
  }

  // Empate frecuente: "Schop" y "Schop Doble" con la misma puntuacion. Gana el
  // nombre mas corto, que es el que el garzon tenia en mente al escribir menos.
  return total * 1000 - nameWords.join(" ").length;
}

/**
 * Ordena una lista por lo escrito y deja fuera lo que no coincide.
 *
 * `boost` sube lo que ya se vende mucho: entre dos productos que empatan, el
 * que salio cien veces esta noche va antes que el que no sale nunca.
 */
export function rankBySearch<T extends { name: string; category?: string | null }>(
  entries: T[],
  query: string,
  boost: (entry: T) => number = () => 0,
): T[] {
  const needles = tokenize(query);
  if (needles.length === 0) return entries;

  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, needles) }))
    .filter(
      (row): row is { entry: T; score: number } => row.score !== null,
    )
    .map((row) => ({ ...row, score: row.score + boost(row.entry) }))
    .sort((a, b) => b.score - a.score)
    .map((row) => row.entry);
}
