import "server-only";

import { INICIO_JORNADA, serviceStart } from "@/lib/dashboard";
import { TIME_ZONE, zonedStartOfHour } from "@/lib/format";
import { lineTotal } from "@/lib/pos";
import { prisma } from "@/lib/prisma";

/**
 * Informes de ventas: el dia y el mes, para mirarlos despues.
 *
 * Es la otra cara de /admin/en-vivo y /admin/caja, que responden por la
 * noche en curso. Aca se pregunta por cualquier jornada o mes ya cerrado, y
 * con comparacion contra el periodo anterior. Lo consume el servidor MCP
 * (/api/mcp) para que Claude arme los informes a pedido.
 *
 * Las mismas reglas que el resto del panel:
 * - La jornada va de las seis de la manana a las seis del dia siguiente, en la
 *   hora del local (ver `serviceStart`). El sabado a las dos de la manana
 *   sigue siendo el sabado.
 * - Los cobros anulados no son plata: salen de todas las cifras y se informan
 *   aparte (ver `voidPayment`).
 * - Lo mas vendido cuenta lo cobrado, no lo cargado.
 */

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

/** De centesimos a la moneda del local, que es como se lee un informe. */
const money = (cents: number) => Math.round(cents / 100);

const pct = (part: number, total: number) =>
  total === 0 ? null : Math.round((part / total) * 1000) / 10;

/** Variacion porcentual; null cuando no hay contra que comparar. */
const change = (now: number, before: number) =>
  before === 0 ? null : Math.round(((now - before) / before) * 1000) / 10;

// --- Fechas ------------------------------------------------------------------

const partsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

/** Mediodia UTC de una fecha del calendario: cae el mismo dia en Chile. */
const noonUtc = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day, 12));

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * La jornada a la que pertenece un instante, como "2026-09-26".
 * Lo cobrado antes de las seis de la manana es de la noche anterior.
 */
export function jornadaOf(instant: Date) {
  const parts = partsFormat.formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);

  const hour = get("hour");
  const day = new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
  if (hour < INICIO_JORNADA) day.setUTCDate(day.getUTCDate() - 1);

  return { date: isoDay(day), weekday: day.getUTCDay(), hour };
}

/** Inicio y fin (exclusivo) de la jornada de una fecha "AAAA-MM-DD". */
export function dayRange(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const reference = noonUtc(year, month, day);

  return {
    start: zonedStartOfHour(reference, INICIO_JORNADA),
    end: zonedStartOfHour(reference, INICIO_JORNADA, -1),
  };
}

/** Inicio y fin (exclusivo) de un mes "AAAA-MM", en jornadas. */
export function monthRange(month: string) {
  const [year, m] = month.split("-").map(Number);

  return {
    start: zonedStartOfHour(noonUtc(year, m, 1), INICIO_JORNADA),
    // El dia 1 del mes siguiente; Date.UTC resuelve el paso de diciembre.
    end: zonedStartOfHour(noonUtc(year, m + 1, 1), INICIO_JORNADA),
  };
}

/** La jornada en curso, "AAAA-MM-DD". */
export const currentJornada = () => jornadaOf(serviceStart()).date;

/** El mes de la jornada en curso, "AAAA-MM". */
export const currentMonth = () => currentJornada().slice(0, 7);

function shiftDay(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDay(d);
}

function shiftMonth(month: string, months: number) {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, m - 1 + months, 1));
  return isoDay(d).slice(0, 7);
}

// --- Lectura -----------------------------------------------------------------

async function loadPeriod(start: Date, end: Date) {
  const [payments, items, sessions] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: start, lt: end } },
      orderBy: { paidAt: "asc" },
      select: {
        code: true,
        subtotalCents: true,
        discountCents: true,
        totalCents: true,
        method: true,
        paidAt: true,
        voidedAt: true,
        voidReason: true,
        cardId: true,
        session: { select: { kind: true } },
        cashier: { select: { name: true } },
      },
    }),

    prisma.orderItem.findMany({
      where: {
        status: { not: "CANCELLED" },
        payment: { paidAt: { gte: start, lt: end }, voidedAt: null },
      },
      select: {
        name: true,
        variant: true,
        station: true,
        quantity: true,
        unitPriceCents: true,
        discountCents: true,
        courtesy: true,
      },
    }),

    prisma.tableSession.findMany({
      where: { openedAt: { gte: start, lt: end } },
      select: { kind: true, guests: true },
    }),
  ]);

  return { payments, items, sessions };
}

type Loaded = Awaited<ReturnType<typeof loadPeriod>>;

type Group = { cobros: number; total: number; porcentaje: number | null };

function groupBy<T>(
  rows: T[],
  key: (row: T) => string,
  cents: (row: T) => number,
  totalCents: number,
): Record<string, Group> {
  const map = new Map<string, { count: number; cents: number }>();

  for (const row of rows) {
    const k = key(row);
    const current = map.get(k) ?? { count: 0, cents: 0 };
    map.set(k, { count: current.count + 1, cents: current.cents + cents(row) });
  }

  return Object.fromEntries(
    [...map.entries()]
      .sort((a, b) => b[1].cents - a[1].cents)
      .map(([k, v]) => [
        k,
        { cobros: v.count, total: money(v.cents), porcentaje: pct(v.cents, totalCents) },
      ]),
  );
}

/** Las cifras de un periodo, sin el desglose en el tiempo. */
function summarize({ payments: todos, items, sessions }: Loaded, topProducts: number) {
  const payments = todos.filter((p) => p.voidedAt === null);
  const voided = todos.filter((p) => p.voidedAt !== null);

  const totalCents = payments.reduce((sum, p) => sum + p.totalCents, 0);
  const subtotalCents = payments.reduce((sum, p) => sum + p.subtotalCents, 0);
  const discountCents = payments.reduce((sum, p) => sum + p.discountCents, 0);

  const byStation = { BARRA: 0, COCINA: 0 };
  const products = new Map<string, { station: string; quantity: number; cents: number }>();
  let courtesies = 0;

  for (const item of items) {
    const cents = lineTotal(item);
    byStation[item.station] += cents;
    if (item.courtesy) courtesies += item.quantity;

    const name = item.variant ? `${item.name} (${item.variant})` : item.name;
    const current = products.get(name) ?? { station: item.station, quantity: 0, cents: 0 };
    products.set(name, {
      station: item.station,
      quantity: current.quantity + item.quantity,
      cents: current.cents + cents,
    });
  }

  const itemsCents = byStation.BARRA + byStation.COCINA;

  const ranking = [...products.entries()].map(([nombre, v]) => ({
    nombre,
    estacion: v.station,
    unidades: v.quantity,
    total: money(v.cents),
  }));

  const guests = sessions
    .filter((s) => s.kind === "MESA")
    .reduce((sum, s) => sum + s.guests, 0);

  return {
    ventas: {
      total: money(totalCents),
      subtotal: money(subtotalCents),
      descuentos: money(discountCents),
      cobros: payments.length,
      ticketPromedio: payments.length ? money(totalCents / payments.length) : 0,
      cobrosConBarzuCard: payments.filter((p) => p.cardId).length,
    },
    porFormaDePago: groupBy(payments, (p) => p.method, (p) => p.totalCents, totalCents),
    porTipoDeCuenta: groupBy(payments, (p) => p.session.kind, (p) => p.totalCents, totalCents),
    porCajero: groupBy(
      payments,
      (p) => p.cashier?.name ?? "Sin registrar",
      (p) => p.totalCents,
      totalCents,
    ),
    porEstacion: {
      BARRA: { total: money(byStation.BARRA), porcentaje: pct(byStation.BARRA, itemsCents) },
      COCINA: { total: money(byStation.COCINA), porcentaje: pct(byStation.COCINA, itemsCents) },
    },
    cuentas: {
      mesas: sessions.filter((s) => s.kind === "MESA").length,
      dePie: sessions.filter((s) => s.kind === "PIE").length,
      ventasDirectas: sessions.filter((s) => s.kind === "DIRECTA").length,
      comensalesEnMesa: guests,
    },
    productos: {
      unidadesVendidas: items.reduce((sum, i) => sum + i.quantity, 0),
      cortesiasBarzuCard: courtesies,
      masVendidos: [...ranking]
        .sort((a, b) => b.unidades - a.unidades || b.total - a.total)
        .slice(0, topProducts),
      mayorFacturacion: [...ranking]
        .sort((a, b) => b.total - a.total)
        .slice(0, topProducts),
    },
    anulados: {
      cobros: voided.length,
      total: money(voided.reduce((sum, p) => sum + p.totalCents, 0)),
      detalle: voided.map((p) => ({
        comprobante: p.code,
        total: money(p.totalCents),
        motivo: p.voidReason,
      })),
    },
  };
}

/**
 * Contra que se compara.
 *
 * Si el periodo sigue en curso se compara contra el mismo tramo del anterior
 * —hasta la misma hora—: comparar media noche contra una noche entera siempre
 * da una caida que no existe.
 */
async function compare(
  current: { start: Date; end: Date; totalCents: number; payments: number },
  previous: { start: Date; end: Date; label: string },
) {
  const now = new Date();
  const inProgress = now < current.end;

  const end = inProgress
    ? new Date(previous.start.getTime() + (now.getTime() - current.start.getTime()))
    : previous.end;

  const payments = await prisma.payment.findMany({
    where: { paidAt: { gte: previous.start, lt: end }, voidedAt: null },
    select: { totalCents: true },
  });

  const totalCents = payments.reduce((sum, p) => sum + p.totalCents, 0);

  return {
    contra: previous.label,
    hastaLaMismaHora: inProgress,
    totalAnterior: money(totalCents),
    cobrosAnterior: payments.length,
    variacionTotal: change(current.totalCents, totalCents),
    variacionCobros: change(current.payments, payments.length),
  };
}

const totalOf = (loaded: Loaded) =>
  loaded.payments
    .filter((p) => p.voidedAt === null)
    .reduce((sum, p) => sum + p.totalCents, 0);

const countOf = (loaded: Loaded) =>
  loaded.payments.filter((p) => p.voidedAt === null).length;

const criterios = [
  `Montos en ${process.env.NEXT_PUBLIC_CURRENCY ?? "CLP"}, sin decimales.`,
  `La jornada va de las ${INICIO_JORNADA}:00 a las ${INICIO_JORNADA}:00 del dia siguiente (hora de ${TIME_ZONE}): lo cobrado de madrugada es de la noche anterior.`,
  "Total = lo cobrado, ya descontadas promociones y beneficios BarzuCard. Sin propina: la propina queda en la terminal de pago.",
  "Los cobros anulados no suman en ninguna cifra y se listan aparte.",
  "Productos y estaciones cuentan solo lo cobrado en el periodo.",
];

// --- Informes ----------------------------------------------------------------

export async function dailyReport(date: string, topProducts = 10) {
  const { start, end } = dayRange(date);
  const loaded = await loadPeriod(start, end);

  // Venta por hora, en orden de la noche (de 6 a 5) y con las horas en cero
  // entre la primera y la ultima: un bache sin ventas tambien es informacion.
  const byHour = new Map<number, { cents: number; count: number }>();
  for (const p of loaded.payments) {
    if (p.voidedAt) continue;
    const { hour } = jornadaOf(p.paidAt);
    const current = byHour.get(hour) ?? { cents: 0, count: 0 };
    byHour.set(hour, { cents: current.cents + p.totalCents, count: current.count + 1 });
  }

  const order = Array.from({ length: 24 }, (_, i) => (INICIO_JORNADA + i) % 24);
  const active = order.filter((h) => byHour.has(h));
  const first = order.indexOf(active[0]);
  const last = order.indexOf(active[active.length - 1]);

  const porHora =
    active.length === 0
      ? []
      : order.slice(first, last + 1).map((hour) => ({
          hora: `${String(hour).padStart(2, "0")}:00`,
          total: money(byHour.get(hour)?.cents ?? 0),
          cobros: byHour.get(hour)?.count ?? 0,
        }));

  const peak = [...porHora].sort((a, b) => b.total - a.total)[0] ?? null;

  // Un bar se compara contra el mismo dia de la semana anterior: un martes
  // contra un lunes no dice nada.
  const previousDate = shiftDay(date, -7);
  const weekday = DIAS[new Date(`${date}T00:00:00Z`).getUTCDay()];

  const comparacion = await compare(
    { start, end, totalCents: totalOf(loaded), payments: countOf(loaded) },
    { ...dayRange(previousDate), label: `${DIAS[new Date(`${previousDate}T00:00:00Z`).getUTCDay()]} ${previousDate}` },
  );

  // Lo que sigue abierto solo importa si se pregunta por la noche en curso.
  const now = new Date();
  let cuentasAbiertas = null;

  if (now >= start && now < end) {
    const open = await prisma.tableSession.findMany({
      where: { status: "OPEN" },
      select: {
        items: {
          where: { status: { not: "CANCELLED" }, paymentId: null },
          select: { unitPriceCents: true, discountCents: true, quantity: true },
        },
      },
    });

    cuentasAbiertas = {
      cuentas: open.length,
      pendientePorCobrar: money(
        open.reduce((sum, s) => sum + s.items.reduce((acc, i) => acc + lineTotal(i), 0), 0),
      ),
    };
  }

  return {
    tipo: "diario",
    jornada: date,
    diaDeLaSemana: weekday,
    desde: start.toISOString(),
    hasta: end.toISOString(),
    enCurso: now >= start && now < end,
    ...summarize(loaded, topProducts),
    porHora,
    horaPeak: peak && peak.total > 0 ? peak : null,
    cuentasAbiertas,
    comparacion,
    criterios,
  };
}

export async function monthlyReport(month: string, topProducts = 15) {
  const { start, end } = monthRange(month);
  const loaded = await loadPeriod(start, end);
  const now = new Date();

  const byDay = new Map<string, { cents: number; count: number }>();
  for (const p of loaded.payments) {
    if (p.voidedAt) continue;
    const { date } = jornadaOf(p.paidAt);
    const current = byDay.get(date) ?? { cents: 0, count: 0 };
    byDay.set(date, { cents: current.cents + p.totalCents, count: current.count + 1 });
  }

  // Todas las jornadas del mes hasta hoy, incluidas las que no vendieron: un
  // dia en cero es un dia cerrado, y eso tambien se lee en un informe.
  const today = currentJornada();
  const days: string[] = [];
  for (let d = `${month}-01`; d.startsWith(month) && d <= today; d = shiftDay(d, 1)) {
    days.push(d);
  }

  const porDia = days.map((date) => {
    const v = byDay.get(date);
    return {
      jornada: date,
      dia: DIAS[new Date(`${date}T00:00:00Z`).getUTCDay()],
      total: money(v?.cents ?? 0),
      cobros: v?.count ?? 0,
    };
  });

  const withSales = porDia.filter((d) => d.cobros > 0);
  const totalCents = totalOf(loaded);

  // Por dia de la semana: cuanto rinde en promedio cada dia que se abrio.
  const weekdays = new Map<string, { cents: number; days: number }>();
  for (const d of withSales) {
    const current = weekdays.get(d.dia) ?? { cents: 0, days: 0 };
    weekdays.set(d.dia, { cents: current.cents + d.total * 100, days: current.days + 1 });
  }

  const porDiaDeLaSemana = [1, 2, 3, 4, 5, 6, 0]
    .map((i) => DIAS[i])
    .filter((dia) => weekdays.has(dia))
    .map((dia) => {
      const v = weekdays.get(dia)!;
      return {
        dia,
        jornadasConVenta: v.days,
        total: money(v.cents),
        promedioPorJornada: money(v.cents / v.days),
      };
    });

  const previousMonth = shiftMonth(month, -1);

  const comparacion = await compare(
    { start, end, totalCents, payments: countOf(loaded) },
    { ...monthRange(previousMonth), label: previousMonth },
  );

  const sorted = [...withSales].sort((a, b) => b.total - a.total);

  return {
    tipo: "mensual",
    mes: month,
    desde: start.toISOString(),
    hasta: end.toISOString(),
    enCurso: now >= start && now < end,
    ...summarize(loaded, topProducts),
    jornadas: {
      conVenta: withSales.length,
      promedioPorJornada: withSales.length ? money(totalCents / withSales.length) : 0,
      mejor: sorted[0] ?? null,
      peor: sorted[sorted.length - 1] ?? null,
    },
    porDia,
    porDiaDeLaSemana,
    comparacion,
    criterios,
  };
}

/** Totales jornada por jornada entre dos fechas: para semanas o tramos a medida. */
export async function rangeReport(from: string, to: string, topProducts = 10) {
  const start = dayRange(from).start;
  const end = dayRange(to).end;
  const loaded = await loadPeriod(start, end);

  const byDay = new Map<string, { cents: number; count: number }>();
  for (const p of loaded.payments) {
    if (p.voidedAt) continue;
    const { date } = jornadaOf(p.paidAt);
    const current = byDay.get(date) ?? { cents: 0, count: 0 };
    byDay.set(date, { cents: current.cents + p.totalCents, count: current.count + 1 });
  }

  const porDia: Array<{ jornada: string; dia: string; total: number; cobros: number }> = [];
  for (let d = from; d <= to; d = shiftDay(d, 1)) {
    const v = byDay.get(d);
    porDia.push({
      jornada: d,
      dia: DIAS[new Date(`${d}T00:00:00Z`).getUTCDay()],
      total: money(v?.cents ?? 0),
      cobros: v?.count ?? 0,
    });
  }

  return {
    tipo: "rango",
    desdeJornada: from,
    hastaJornada: to,
    desde: start.toISOString(),
    hasta: end.toISOString(),
    ...summarize(loaded, topProducts),
    porDia,
    criterios,
  };
}
