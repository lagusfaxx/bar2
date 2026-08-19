/**
 * Paleta de la sala: colores de las zonas y de las etiquetas de mesa.
 *
 * Vive fuera de `lib/pos.ts` a proposito. Ese modulo es `server-only` —lee la
 * base— y estas son constantes que tienen que pintar tanto el panel como el
 * POS, que corren en el navegador.
 */

/**
 * Colores con los que se pinta una zona en el mapa de sala.
 *
 * La paleta la define el diseño y las zonas eligen de esta lista: si el color
 * fuera texto libre, la primera zona cargada de apuro dejaria el mapa con un
 * fucsia que no combina con nada y no hay forma de arreglarlo desde el codigo.
 */
export const ZONE_COLORS = {
  bone: { label: "Hueso", border: "border-bone/35", dot: "bg-bone/70" },
  gilt: { label: "Dorado", border: "border-gilt/45", dot: "bg-gilt" },
  esmeralda: {
    label: "Verde",
    border: "border-emerald-500/45",
    dot: "bg-emerald-400",
  },
  cielo: { label: "Azul", border: "border-sky-500/45", dot: "bg-sky-400" },
  violeta: {
    label: "Violeta",
    border: "border-violet-500/45",
    dot: "bg-violet-400",
  },
} as const;

export type ZoneColor = keyof typeof ZONE_COLORS;

export const zoneColor = (key: string | null | undefined) =>
  (key && key in ZONE_COLORS ? ZONE_COLORS[key as ZoneColor] : ZONE_COLORS.bone);

/**
 * Colores de la etiqueta de una mesa.
 *
 * Mismo criterio que las zonas, con un motivo mas: la etiqueta se lee de
 * costado y a distancia, y el color es lo primero que llega. Rojo tiene que
 * querer decir siempre lo mismo.
 */
export const TAG_COLORS = {
  gilt: { label: "Dorado", chip: "border-gilt/50 bg-gilt/15 text-gilt-soft" },
  crimson: {
    label: "Rojo",
    chip: "border-crimson/50 bg-crimson/15 text-crimson-bright",
  },
  esmeralda: {
    label: "Verde",
    chip: "border-emerald-500/50 bg-emerald-500/15 text-emerald-200",
  },
  cielo: {
    label: "Azul",
    chip: "border-sky-500/50 bg-sky-500/15 text-sky-200",
  },
  violeta: {
    label: "Violeta",
    chip: "border-violet-500/50 bg-violet-500/15 text-violet-200",
  },
} as const;

export type TagColor = keyof typeof TAG_COLORS;

export const tagColor = (key: string | null | undefined) =>
  key && key in TAG_COLORS ? TAG_COLORS[key as TagColor] : TAG_COLORS.gilt;

/**
 * Etiquetas que se ponen todas las noches.
 *
 * Estan aca para que poner "Cumpleaños" sea un toque y no escribir la palabra
 * con una mano mientras se sostiene la bandeja con la otra. La etiqueta libre
 * sigue existiendo para lo que no esta en la lista.
 */
export const TAG_PRESETS: Array<{ label: string; color: TagColor }> = [
  { label: "Cumpleaños", color: "gilt" },
  { label: "Reservada", color: "cielo" },
  { label: "VIP", color: "violeta" },
  { label: "Apurados", color: "crimson" },
  { label: "Celebración", color: "esmeralda" },
];

