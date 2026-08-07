const LOCALE = "es-CL";
const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE ?? "America/Santiago";
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "CLP";

/** Precios se guardan en centesimos para evitar errores de coma flotante. */
export function formatPrice(cents: number | null | undefined) {
  if (cents == null) return "";

  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Duracion de una cancion: "4:07".
 *
 * Vive aca y no en `lib/karaoke.ts` porque la pantalla del karaoke la usa
 * desde el cliente, y ese modulo es `server-only`.
 */
export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return null;

  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatDate(date: Date | string, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...opts,
  }).format(new Date(date));
}

export function formatTime(date: Date | string) {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string) {
  return `${formatDate(date)} · ${formatTime(date)}`;
}

/** Partes sueltas para maquetar fechas (ej. el bloque del afiche). */
export function dateParts(date: Date | string) {
  const value = new Date(date);
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, ...opts }).format(value);

  return {
    day: fmt({ day: "2-digit" }),
    month: fmt({ month: "short" }).replace(".", "").toUpperCase(),
    // El mes en numero, para las fechas cortas del tipo "06/08". Sale del
    // mismo formateador que el dia y no de `getMonth()`, que usa la zona del
    // servidor: mezclarlos daba fechas imposibles como "31/09" en un show de
    // fin de mes que empieza de noche.
    monthNumeric: fmt({ month: "2-digit" }),
    monthLong: fmt({ month: "long" }),
    weekday: fmt({ weekday: "long" }),
    weekdayShort: fmt({ weekday: "short" }).replace(".", "").toUpperCase(),
    year: fmt({ year: "numeric" }),
    time: formatTime(value),
  };
}

/*
 * Dias sueltos, sin hora.
 *
 * Las columnas `date` de Postgres guardan un dia y nada mas, y vuelven como la
 * medianoche UTC de ese dia. Leerlas con la zona del local las retrocede: la
 * medianoche UTC del 6 de agosto son las 20:00 del 5 en Santiago, asi que un
 * cierre cargado para el jueves se mostraba —y se comparaba— como miercoles.
 * Estas dos funciones las leen en UTC, que es donde el dia esta intacto.
 *
 * No sirven para un instante con hora (el inicio de un show, por ejemplo): ahi
 * la zona del local es justamente lo que hay que aplicar.
 */

/** Clave YYYY-MM-DD de un dia suelto. */
export function dateOnlyKey(date: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

/** Un dia suelto escrito en palabras: "jueves, 06 de agosto de 2026". */
export function formatDateOnly(
  date: Date | string,
  opts?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...opts,
  }).format(new Date(date));
}

/** Clave YYYY-MM-DD en la zona horaria del local (no en UTC). */
export function dayKey(date: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

export function relativeDay(date: Date | string) {
  const today = dayKey(new Date());
  const target = dayKey(date);

  if (target === today) return "Hoy";

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (target === dayKey(tomorrow)) return "Mañana";

  return null;
}

/** "4521 8890 1234 5678" — formato legible del numero de BarzuCard. */
export function formatCardNumber(cardNumber: string) {
  return cardNumber.replace(/(.{4})/g, "$1 ").trim();
}

export const EVENT_CATEGORY_LABELS: Record<string, string> = {
  TRIBUTO: "Tributo",
  EN_VIVO: "En vivo",
  DJ: "DJ set",
  KARAOKE: "Karaoke",
  STANDUP: "Stand up",
  FIESTA: "Fiesta",
  ESPECIAL: "Especial",
};

export const PROMOTION_TYPE_LABELS: Record<string, string> = {
  PERCENT_OFF: "Descuento %",
  AMOUNT_OFF: "Descuento fijo",
  TWO_FOR_ONE: "2x1",
  FREE_ITEM: "Cortesía",
  OTHER: "Beneficio",
};

export const TIER_LABELS: Record<string, string> = {
  CLASICA: "Clásica",
  PLATA: "Plata",
  ORO: "Oro",
};

export const WEEKDAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

/** Version corta, para donde no sobra el ancho (el pie en telefono). */
export const WEEKDAY_SHORT = [
  "Dom",
  "Lun",
  "Mar",
  "Mié",
  "Jue",
  "Vie",
  "Sáb",
];

type OpeningHourLike = {
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  closed: boolean;
  note: string | null;
};

/** Posicion del dia en una semana que empieza el lunes. */
const weekPosition = (dayOfWeek: number) => (dayOfWeek + 6) % 7;

/**
 * Agrupa los días seguidos que abren a la misma hora.
 *
 * Siete filas de horario son media pantalla de teléfono en el pie, y casi
 * siempre repiten el mismo valor: "Mar – Jue 19:00 – 02:00" dice lo mismo en
 * un tercio del espacio. Los días con nota propia ("cocina hasta la 01:00") no
 * se agrupan: la nota es de ese día y perderla cambiaría el sentido.
 */
export function groupOpeningHours(hours: OpeningHourLike[]) {
  const ordered = [...hours].sort(
    (a, b) => weekPosition(a.dayOfWeek) - weekPosition(b.dayOfWeek),
  );

  const groups: Array<{
    firstDay: number;
    lastDay: number;
    value: string;
    closed: boolean;
    note: string | null;
  }> = [];

  for (const hour of ordered) {
    const value = hour.closed
      ? "Cerrado"
      : `${hour.opensAt ?? ""} – ${hour.closesAt ?? ""}`;

    const previous = groups.at(-1);
    const consecutive =
      previous &&
      weekPosition(hour.dayOfWeek) === weekPosition(previous.lastDay) + 1;

    if (previous && consecutive && previous.value === value && !previous.note && !hour.note) {
      previous.lastDay = hour.dayOfWeek;
      continue;
    }

    groups.push({
      firstDay: hour.dayOfWeek,
      lastDay: hour.dayOfWeek,
      value,
      closed: hour.closed,
      note: hour.note,
    });
  }

  return groups.map((group) => ({
    key: `${group.firstDay}-${group.lastDay}`,
    label:
      group.firstDay === group.lastDay
        ? WEEKDAY_LABELS[group.firstDay]
        : `${WEEKDAY_SHORT[group.firstDay]} – ${WEEKDAY_SHORT[group.lastDay]}`,
    value: group.value,
    closed: group.closed,
    note: group.note,
  }));
}

/** Texto corto del beneficio, según el tipo de promoción. */
export function promotionValueLabel(type: string, value: number) {
  switch (type) {
    case "PERCENT_OFF":
      return `${value}% OFF`;
    case "AMOUNT_OFF":
      return `${formatPrice(value)} OFF`;
    case "TWO_FOR_ONE":
      return "2x1";
    case "FREE_ITEM":
      return "Cortesía";
    default:
      return "Beneficio";
  }
}

/**
 * Valor para un <input type="datetime-local"> expresado en la hora de pared del
 * local. Sin esto, el navegador mostraria la hora en la zona del visitante y el
 * administrador editaria un horario distinto al que ve el publico.
 */
export function toDateTimeLocal(date: Date | string | null | undefined) {
  if (!date) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .formatToParts(new Date(date))
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  // Intl puede devolver "24" para la medianoche segun el motor.
  const hour = parts.hour === "24" ? "00" : parts.hour;

  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/** Valor para un <input type="date"> a partir de una fecha. */
export function toDateInput(date: Date | string | null | undefined) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}
