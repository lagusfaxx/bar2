import "server-only";

import { INICIO_JORNADA, serviceStart } from "@/lib/dashboard";
import { dateOnlyKey, formatTime, TIME_ZONE, zonedStartOfHour } from "@/lib/format";
import { lineTotal, sessionTitle } from "@/lib/pos";
import { prisma } from "@/lib/prisma";

/**
 * Informes de ventas del bar: la jornada, el mes o un tramo, con todo lo que
 * se mira en un bar —venta, ticket por persona, mix de productos, pour cost y
 * food cost, ingenieria de menu, salon, tiempos de barra y cocina,
 * cancelaciones, BarzuCard, eventos y karaoke—.
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
 * - Lo que el sistema no sabe (propinas, sueldos, stock) se dice en
 *   `noDisponible`, para que nadie lo invente.
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

/**
 * Los dias marcados como cerrados (evento privado, vacaciones) entre dos
 * jornadas. Un cero en un dia cerrado no es un mal dia, y el informe lo dice.
 */
async function closedDays(from: string, to: string) {
  const days = await prisma.closedDay.findMany({
    where: { date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } },
    select: { date: true, reason: true },
  });

  return new Map(days.map((d) => [dateOnlyKey(d.date), d.reason]));
}

/** Tasa de IVA incluida en los precios de la carta (Chile: 19 %). */
const IVA = Number(process.env.REPORT_VAT_RATE ?? 0.19);

/** Una comanda que tarda mas que esto ya es una espera que se nota. */
const DEMORA_MIN = 15;

type Money = number;

const sum = <T>(rows: T[], f: (row: T) => number) => rows.reduce((acc, r) => acc + f(r), 0);

const round1 = (n: number) => Math.round(n * 10) / 10;

function percentile(values: number[], p: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return round1(sorted[Math.max(0, i)]);
}

const minutes = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 60000;

const weekdayOf = (date: string) => DIAS[new Date(`${date}T00:00:00Z`).getUTCDay()];

const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/** Las horas en el orden de la noche: de las 6 a las 5. */
const HOUR_ORDER = Array.from({ length: 24 }, (_, i) => (INICIO_JORNADA + i) % 24);

// --- Lectura del periodo -----------------------------------------------------

async function loadPeriod(start: Date, end: Date) {
  const period = { gte: start, lt: end };

  const [
    payments,
    items,
    cancelled,
    tickets,
    redemptions,
    vouchers,
    newMembers,
    activeCards,
    tables,
    karaoke,
    events,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: period },
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
        cashier: { select: { name: true } },
        voidedBy: { select: { name: true } },
        session: {
          select: {
            id: true,
            kind: true,
            guests: true,
            status: true,
            openedAt: true,
            closedAt: true,
            label: true,
            table: { select: { number: true, name: true, zone: true } },
          },
        },
      },
    }),

    // Lo cobrado: es lo que de verdad se vendio.
    prisma.orderItem.findMany({
      where: {
        status: { not: "CANCELLED" },
        payment: { paidAt: period, voidedAt: null },
      },
      select: {
        name: true,
        variant: true,
        station: true,
        quantity: true,
        unitPriceCents: true,
        unitCostCents: true,
        discountCents: true,
        discountLabel: true,
        courtesy: true,
        sessionId: true,
        productId: true,
        product: {
          select: { costCents: true, category: { select: { name: true } } },
        },
        createdBy: { select: { name: true } },
        payment: { select: { cardId: true } },
      },
    }),

    /*
     * Lo que se cargo y se saco de la cuenta.
     *
     * Sin las ventas directas: una directa no se corrige linea por linea, y
     * sus lineas canceladas son las de una venta anulada, que ya se informa
     * en `anulados`. Al cancelar, `createdById` pasa a ser quien cancelo.
     */
    prisma.orderItem.findMany({
      where: {
        status: "CANCELLED",
        updatedAt: period,
        session: { kind: { not: "DIRECTA" } },
      },
      select: {
        name: true,
        quantity: true,
        unitPriceCents: true,
        discountCents: true,
        ticketId: true,
        createdBy: { select: { name: true } },
      },
    }),

    prisma.orderTicket.findMany({
      where: { kind: "COMANDA", createdAt: period },
      select: { station: true, createdAt: true, pickedUpAt: true, prep: true, status: true },
    }),

    prisma.redemption.findMany({
      where: { redeemedAt: period, voidedAt: null },
      select: {
        discountCents: true,
        cardId: true,
        promotion: { select: { title: true, type: true } },
        staffUser: { select: { name: true } },
      },
    }),

    prisma.promotionVoucher.groupBy({
      by: ["status"],
      where: { createdAt: period },
      _count: true,
    }),

    prisma.member.count({ where: { createdAt: period } }),

    prisma.barzuCard.count({ where: { status: "ACTIVE" } }),

    prisma.posTable.count({ where: { active: true } }),

    prisma.karaokeEntry.findMany({
      where: { createdAt: period },
      select: {
        status: true,
        source: true,
        requestText: true,
        track: { select: { title: true } },
      },
    }),

    prisma.event.findMany({
      where: { published: true, startsAt: period },
      orderBy: { startsAt: "asc" },
      select: {
        title: true,
        artist: true,
        category: true,
        startsAt: true,
        isFree: true,
        priceCents: true,
        access: true,
        ratings: { where: { approved: true }, select: { rating: true } },
      },
    }),
  ]);

  return {
    payments,
    items,
    cancelled,
    tickets,
    redemptions,
    vouchers,
    newMembers,
    activeCards,
    tables,
    karaoke,
    events,
  };
}

type Loaded = Awaited<ReturnType<typeof loadPeriod>>;
type PaidItem = Loaded["items"][number];

// --- Agrupaciones ------------------------------------------------------------

type Tally = { count: number; cents: number };

function tally<T>(rows: T[], key: (row: T) => string, cents: (row: T) => number) {
  const map = new Map<string, Tally>();
  for (const row of rows) {
    const k = key(row);
    const current = map.get(k) ?? { count: 0, cents: 0 };
    map.set(k, { count: current.count + 1, cents: current.cents + cents(row) });
  }
  return map;
}

function shares(map: Map<string, Tally>, totalCents: number, countLabel = "cobros") {
  return [...map.entries()]
    .sort((a, b) => b[1].cents - a[1].cents)
    .map(([nombre, v]) => ({
      nombre,
      [countLabel]: v.count,
      total: money(v.cents),
      porcentaje: pct(v.cents, totalCents),
    }));
}

/** El costo de una linea: el copiado al venderla o, si no hay, el actual. */
function costOf(item: PaidItem) {
  if (item.unitCostCents !== null) return { cents: item.unitCostCents * item.quantity, estimated: false };
  if (item.product?.costCents != null) {
    return { cents: item.product.costCents * item.quantity, estimated: true };
  }
  return null;
}

/**
 * Ingenieria de menu (Kasavana y Smith).
 *
 * Cruza popularidad y margen de contribucion de cada producto contra el resto
 * de su estacion —bebida contra bebida, comida contra comida— y lo ubica en
 * uno de cuatro cuadrantes. Popular es vender al menos el 70 % de lo que le
 * tocaria si todos vendieran igual; rentable es dejar mas margen por unidad
 * que el promedio ponderado.
 */
function menuEngineering(
  products: Array<{
    nombre: string;
    estacion: string;
    unidades: number;
    ventaCents: number;
    costoCents: number | null;
  }>,
) {
  const out: Array<Record<string, unknown>> = [];

  for (const station of ["BARRA", "COCINA"]) {
    const rows = products.filter((p) => p.estacion === station && p.costoCents !== null && p.unidades > 0);
    if (rows.length < 2) continue;

    const units = sum(rows, (r) => r.unidades);
    const margin = sum(rows, (r) => r.ventaCents - (r.costoCents ?? 0));
    const popularityThreshold = (units / rows.length) * 0.7;
    const marginThreshold = margin / units;

    for (const r of rows) {
      const unitMargin = (r.ventaCents - (r.costoCents ?? 0)) / r.unidades;
      const popular = r.unidades >= popularityThreshold;
      const profitable = unitMargin >= marginThreshold;

      out.push({
        nombre: r.nombre,
        estacion: station,
        unidades: r.unidades,
        mixPorcentaje: pct(r.unidades, units),
        precioPromedio: money(r.ventaCents / r.unidades),
        costoUnitario: money((r.costoCents ?? 0) / r.unidades),
        margenUnitario: money(unitMargin),
        margenTotal: money(r.ventaCents - (r.costoCents ?? 0)),
        costoPorcentaje: pct(r.costoCents ?? 0, r.ventaCents),
        clasificacion: popular
          ? profitable
            ? "ESTRELLA"
            : "CABALLO_DE_BATALLA"
          : profitable
            ? "ENIGMA"
            : "PERRO",
      });
    }
  }

  return out.sort((a, b) => (b.margenTotal as number) - (a.margenTotal as number));
}

// --- El analisis -------------------------------------------------------------

async function analyze(start: Date, end: Date, top: number) {
  const data = await loadPeriod(start, end);

  const payments = data.payments.filter((p) => p.voidedAt === null);
  const voided = data.payments.filter((p) => p.voidedAt !== null);
  const items = data.items;

  // --- Venta ---------------------------------------------------------------

  const totalCents = sum(payments, (p) => p.totalCents);
  const listCents = sum(payments, (p) => p.subtotalCents);
  const discountCents = sum(payments, (p) => p.discountCents);
  const menuPromoCents = sum(items, (i) => i.discountCents * i.quantity);
  const benefitCents = sum(data.redemptions, (r) => r.discountCents);
  const courtesies = items.filter((i) => i.courtesy);

  // Cuentas atendidas: las que tuvieron al menos un cobro valido.
  const sessions = new Map<string, (typeof payments)[number]["session"]>();
  for (const p of payments) sessions.set(p.session.id, p.session);
  const accounts = [...sessions.values()];
  const covers = sum(accounts, (s) => s.guests);
  const unitsSold = sum(items, (i) => i.quantity);

  const netOfVat = totalCents / (1 + IVA);

  // --- Costo y margen ------------------------------------------------------

  let costCents = 0;
  let costedSalesCents = 0;
  let estimatedLines = 0;
  const byStationCost = {
    BARRA: { venta: 0, costo: 0, ventaConCosto: 0 },
    COCINA: { venta: 0, costo: 0, ventaConCosto: 0 },
  };

  for (const item of items) {
    const revenue = lineTotal(item);
    byStationCost[item.station].venta += revenue;
    const cost = costOf(item);
    if (!cost) continue;
    if (cost.estimated) estimatedLines++;
    costCents += cost.cents;
    costedSalesCents += revenue;
    byStationCost[item.station].costo += cost.cents;
    byStationCost[item.station].ventaConCosto += revenue;
  }

  const itemsCents = byStationCost.BARRA.venta + byStationCost.COCINA.venta;
  const coverage = pct(costedSalesCents, itemsCents);

  const costos =
    costedSalesCents === 0
      ? {
          disponible: false,
          nota: "Ningún producto vendido tiene costo cargado. Cárgalo en Carta → producto → «Costo por porción» para ver margen, pour cost y food cost.",
        }
      : {
          disponible: true,
          coberturaPorcentaje: coverage,
          ventaConCosto: money(costedSalesCents),
          costoDeLoVendido: money(costCents),
          margenBruto: money(costedSalesCents - costCents),
          margenBrutoPorcentaje: pct(costedSalesCents - costCents, costedSalesCents),
          costoPorcentaje: pct(costCents, costedSalesCents),
          pourCostBarra: pct(byStationCost.BARRA.costo, byStationCost.BARRA.ventaConCosto),
          foodCostCocina: pct(byStationCost.COCINA.costo, byStationCost.COCINA.ventaConCosto),
          lineasConCostoActual: estimatedLines,
          nota:
            (coverage ?? 0) < 100
              ? "Solo cuenta los productos con costo cargado; la cobertura dice qué parte de la venta entra al cálculo."
              : undefined,
        };

  // --- Productos -----------------------------------------------------------

  const products = new Map<
    string,
    { station: string; category: string; units: number; cents: number; cost: number | null }
  >();
  const variants = new Map<string, number>();
  const categories = new Map<string, { station: string; units: number; cents: number }>();

  for (const item of items) {
    const revenue = lineTotal(item);
    const cost = costOf(item);
    const category = item.product?.category.name ?? "Sin categoría";

    const p = products.get(item.name) ?? {
      station: item.station,
      category,
      units: 0,
      cents: 0,
      cost: 0 as number | null,
    };
    products.set(item.name, {
      ...p,
      units: p.units + item.quantity,
      cents: p.cents + revenue,
      cost: cost && p.cost !== null ? p.cost + cost.cents : null,
    });

    if (item.variant) {
      const key = `${item.name} · ${item.variant}`;
      variants.set(key, (variants.get(key) ?? 0) + item.quantity);
    }

    const c = categories.get(category) ?? { station: item.station, units: 0, cents: 0 };
    categories.set(category, { ...c, units: c.units + item.quantity, cents: c.cents + revenue });
  }

  const ranking = [...products.entries()].map(([nombre, v]) => ({
    nombre,
    categoria: v.category,
    estacion: v.station,
    unidades: v.units,
    total: money(v.cents),
    porcentajeVenta: pct(v.cents, itemsCents),
  }));

  // ABC (Pareto): cuantos productos hacen el 80 % de la venta.
  const byRevenue = [...ranking].sort((a, b) => b.total - a.total);
  let cumulative = 0;
  const abc = { A: [] as string[], B: [] as string[], C: [] as string[] };
  for (const p of byRevenue) {
    const share = itemsCents === 0 ? 0 : (cumulative / (itemsCents / 100)) * 100;
    (share < 80 ? abc.A : share < 95 ? abc.B : abc.C).push(p.nombre);
    cumulative += p.total;
  }

  // Lo que esta en la carta y nadie pidio.
  const soldIds = new Set(items.map((i) => i.productId).filter(Boolean));
  const catalog = await prisma.menuProduct.findMany({
    where: { available: true, category: { active: true } },
    select: { id: true, name: true, category: { select: { name: true } } },
  });
  const unsold = catalog.filter((p) => !soldIds.has(p.id));

  // --- Personas ------------------------------------------------------------

  const waiters = new Map<string, { cents: number; units: number; accounts: Set<string> }>();
  for (const item of items) {
    const name = item.createdBy?.name ?? "Sin registrar";
    const w = waiters.get(name) ?? { cents: 0, units: 0, accounts: new Set<string>() };
    w.cents += lineTotal(item);
    w.units += item.quantity;
    w.accounts.add(item.sessionId);
    waiters.set(name, w);
  }

  // --- Salon ---------------------------------------------------------------

  const tableAccounts = accounts.filter((s) => s.kind === "MESA");
  const stays = (kind: string) =>
    accounts
      .filter((s) => s.kind === kind && s.closedAt)
      .map((s) => minutes(s.openedAt, s.closedAt!));

  const byTable = tally(
    payments.filter((p) => p.session.table),
    (p) => `Mesa ${p.session.table!.number}${p.session.table!.name ? ` (${p.session.table!.name})` : ""}`,
    (p) => p.totalCents,
  );
  const byZone = tally(
    payments.filter((p) => p.session.kind === "MESA"),
    (p) => p.session.table?.zone ?? "Sin zona",
    (p) => p.totalCents,
  );

  const kindStats = (["MESA", "PIE", "DIRECTA"] as const).map((kind) => {
    const acc = accounts.filter((s) => s.kind === kind);
    const cents = sum(
      payments.filter((p) => p.session.kind === kind),
      (p) => p.totalCents,
    );
    const g = sum(acc, (s) => s.guests);
    return {
      tipo: kind,
      cuentas: acc.length,
      personas: g,
      total: money(cents),
      porcentaje: pct(cents, totalCents),
      ticketPorCuenta: acc.length ? money(cents / acc.length) : 0,
      ticketPorPersona: g ? money(cents / g) : 0,
    };
  });

  // --- Cocina y barra ------------------------------------------------------

  const service = (["BARRA", "COCINA"] as const).map((station) => {
    const own = data.tickets.filter((t) => t.station === station);
    const waits = own
      .filter((t) => t.pickedUpAt)
      .map((t) => minutes(t.createdAt, t.pickedUpAt!))
      // Una comanda retirada horas despues es una que nadie cerro, no una espera.
      .filter((m) => m >= 0 && m < 180);
    return {
      estacion: station,
      comandas: own.length,
      esperaPromedioMin: waits.length ? round1(sum(waits, (w) => w) / waits.length) : null,
      esperaMedianaMin: percentile(waits, 50),
      espera90Min: percentile(waits, 90),
      peorEsperaMin: waits.length ? round1(Math.max(...waits)) : null,
      [`sobre${DEMORA_MIN}Min`]: waits.filter((w) => w > DEMORA_MIN).length,
      impresionesFallidas: own.filter((t) => t.status === "FAILED").length,
    };
  });

  // --- Cancelaciones -------------------------------------------------------

  const cancelledCents = sum(data.cancelled, (i) => lineTotal(i));
  const afterSent = data.cancelled.filter((i) => i.ticketId);

  // --- BarzuCard -----------------------------------------------------------

  const withCard = payments.filter((p) => p.cardId);
  const withCardCents = sum(withCard, (p) => p.totalCents);
  const withoutCard = payments.length - withCard.length;
  const promos = new Map<string, { type: string; count: number; cents: number }>();
  for (const r of data.redemptions) {
    const k = r.promotion.title;
    const v = promos.get(k) ?? { type: r.promotion.type, count: 0, cents: 0 };
    promos.set(k, { ...v, count: v.count + 1, cents: v.cents + r.discountCents });
  }
  const voucherCount = (status: string) =>
    data.vouchers.find((v) => v.status === status)?._count ?? 0;

  // --- Karaoke -------------------------------------------------------------

  const songs = new Map<string, number>();
  for (const k of data.karaoke.filter((k) => k.status === "CANTADA")) {
    const title = k.track?.title ?? k.requestText ?? "Sin título";
    songs.set(title, (songs.get(title) ?? 0) + 1);
  }

  // --- Resultado -----------------------------------------------------------

  return {
    data,
    payments,
    totalCents,
    covers,
    accountsCount: accounts.length,
    report: {
      resumen: {
        ventaTotal: money(totalCents),
        ventaNetaSinIva: money(netOfVat),
        iva: money(totalCents - netOfVat),
        ventaAPrecioDeLista: money(listCents),
        descuentosTotales: money(discountCents),
        descuentosPorcentajeSobreLista: pct(discountCents, listCents),
        cobros: payments.length,
        cuentasAtendidas: accounts.length,
        personasAtendidas: covers,
        ticketPromedioPorCobro: payments.length ? money(totalCents / payments.length) : 0,
        ticketPromedioPorCuenta: accounts.length ? money(totalCents / accounts.length) : 0,
        ticketPromedioPorPersona: covers ? money(totalCents / covers) : 0,
        unidadesVendidas: unitsSold,
        unidadesPorPersona: covers ? round1(unitsSold / covers) : 0,
        margenBruto: costos.disponible ? (costos as { margenBruto: Money }).margenBruto : null,
      },
      costosYMargen: costos,
      descuentos: {
        promocionesDeLaCarta: money(menuPromoCents),
        beneficiosBarzuCard: money(benefitCents),
        cortesias: {
          unidades: sum(courtesies, (i) => i.quantity),
          valorAPrecioDeLista: money(sum(courtesies, (i) => i.unitPriceCents * i.quantity)),
        },
        porEtiqueta: shares(
          tally(
            items.filter((i) => i.discountCents > 0),
            (i) => i.discountLabel ?? "Promo",
            (i) => i.discountCents * i.quantity,
          ),
          menuPromoCents,
          "lineas",
        ),
      },
      porFormaDePago: shares(tally(payments, (p) => p.method, (p) => p.totalCents), totalCents),
      porTipoDeCuenta: kindStats,
      porCajero: shares(
        tally(payments, (p) => p.cashier?.name ?? "Sin registrar", (p) => p.totalCents),
        totalCents,
      ),
      porGarzon: [...waiters.entries()]
        .sort((a, b) => b[1].cents - a[1].cents)
        .map(([nombre, w]) => ({
          nombre,
          ventaCargada: money(w.cents),
          porcentaje: pct(w.cents, itemsCents),
          unidades: w.units,
          cuentas: w.accounts.size,
          promedioPorCuenta: money(w.cents / w.accounts.size),
        })),
      porEstacion: (["BARRA", "COCINA"] as const).map((s) => ({
        estacion: s,
        total: money(byStationCost[s].venta),
        porcentaje: pct(byStationCost[s].venta, itemsCents),
      })),
      porCategoria: [...categories.entries()]
        .sort((a, b) => b[1].cents - a[1].cents)
        .map(([nombre, c]) => ({
          nombre,
          estacion: c.station,
          unidades: c.units,
          total: money(c.cents),
          porcentaje: pct(c.cents, itemsCents),
        })),
      productos: {
        distintosVendidos: products.size,
        masVendidos: [...ranking]
          .sort((a, b) => b.unidades - a.unidades || b.total - a.total)
          .slice(0, top),
        mayorFacturacion: byRevenue.slice(0, top),
        menosVendidos: [...ranking]
          .sort((a, b) => a.unidades - b.unidades || a.total - b.total)
          .slice(0, Math.min(top, 10)),
        opcionesElegidas: [...variants.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, top)
          .map(([nombre, unidades]) => ({ nombre, unidades })),
        analisisABC: {
          A: { productos: abc.A.length, criterio: "hacen el 80 % de la venta", nombres: abc.A.slice(0, 30) },
          B: { productos: abc.B.length, criterio: "el siguiente 15 %" },
          C: { productos: abc.C.length, criterio: "el último 5 %", nombres: abc.C.slice(0, 30) },
        },
        ingenieriaDeMenu: costos.disponible
          ? menuEngineering(
              [...products.entries()].map(([nombre, v]) => ({
                nombre,
                estacion: v.station,
                unidades: v.units,
                ventaCents: v.cents,
                costoCents: v.cost,
              })),
            ).slice(0, Math.max(top, 30))
          : "Requiere costo por porción cargado en la carta.",
        disponiblesSinVentas: {
          cantidad: unsold.length,
          nombres: unsold.slice(0, 40).map((p) => `${p.name} (${p.category.name})`),
        },
      },
      salon: {
        mesasActivas: data.tables,
        cuentasDeMesa: tableAccounts.length,
        rotacionPorMesa: data.tables ? round1(tableAccounts.length / data.tables) : null,
        permanenciaPromedioMin: {
          MESA: (() => {
            const s = stays("MESA");
            return s.length ? Math.round(sum(s, (x) => x) / s.length) : null;
          })(),
          PIE: (() => {
            const s = stays("PIE");
            return s.length ? Math.round(sum(s, (x) => x) / s.length) : null;
          })(),
        },
        personasPorMesa: tableAccounts.length ? round1(sum(tableAccounts, (s) => s.guests) / tableAccounts.length) : null,
        porZona: shares(byZone, totalCents),
        mesasQueMasVendieron: shares(byTable, totalCents).slice(0, top),
      },
      tiemposDeServicio: service,
      cancelaciones: {
        lineas: data.cancelled.length,
        unidades: sum(data.cancelled, (i) => i.quantity),
        valor: money(cancelledCents),
        porcentajeSobreVenta: pct(cancelledCents, totalCents),
        despuesDeEnviarALaEstacion: {
          lineas: afterSent.length,
          valor: money(sum(afterSent, (i) => lineTotal(i))),
          nota: "Ya habían salido a barra o cocina: posible merma.",
        },
        porProducto: shares(
          tally(data.cancelled, (i) => i.name, (i) => lineTotal(i)),
          cancelledCents,
          "lineas",
        ).slice(0, top),
        porQuienCancelo: shares(
          tally(data.cancelled, (i) => i.createdBy?.name ?? "Sin registrar", (i) => lineTotal(i)),
          cancelledCents,
          "lineas",
        ),
      },
      anulados: {
        cobros: voided.length,
        total: money(sum(voided, (p) => p.totalCents)),
        detalle: voided.map((p) => ({
          comprobante: p.code,
          total: money(p.totalCents),
          metodo: p.method,
          motivo: p.voidReason,
          anuladoPor: p.voidedBy?.name ?? null,
        })),
      },
      barzucard: {
        cobrosConTarjeta: withCard.length,
        porcentajeDeCobros: pct(withCard.length, payments.length),
        ventaConTarjeta: money(withCardCents),
        porcentajeDeVenta: pct(withCardCents, totalCents),
        ticketConTarjeta: withCard.length ? money(withCardCents / withCard.length) : null,
        ticketSinTarjeta: withoutCard ? money((totalCents - withCardCents) / withoutCard) : null,
        sociosDistintos: new Set(withCard.map((p) => p.cardId)).size,
        sociosNuevos: data.newMembers,
        tarjetasActivasHoy: data.activeCards,
        beneficiosCanjeados: {
          cantidad: data.redemptions.length,
          descuento: money(benefitCents),
          porPromocion: [...promos.entries()]
            .sort((a, b) => b[1].count - a[1].count)
            .map(([nombre, v]) => ({ nombre, tipo: v.type, canjes: v.count, descuento: money(v.cents) })),
        },
        cupones: {
          emitidos: sum(data.vouchers, (v) => v._count),
          canjeados: voucherCount("REDEEMED"),
          pendientes: voucherCount("PENDING"),
          vencidos: voucherCount("EXPIRED"),
          cancelados: voucherCount("CANCELLED"),
        },
      },
      karaoke: {
        pedidas: data.karaoke.length,
        cantadas: data.karaoke.filter((k) => k.status === "CANTADA").length,
        descartadas: data.karaoke.filter((k) => k.status === "DESCARTADA").length,
        porQrDeLaMesa: data.karaoke.filter((k) => k.source !== "SALA").length,
        cancionesMasCantadas: [...songs.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([titulo, veces]) => ({ titulo, veces })),
      },
    },
  };
}

type Analysis = Awaited<ReturnType<typeof analyze>>;

/** Venta por jornada, con los dias cerrados marcados. */
async function byJornada(analysis: Analysis, days: string[]) {
  const map = new Map<string, { cents: number; count: number; guests: Set<string>; covers: number }>();
  for (const p of analysis.payments) {
    const { date } = jornadaOf(p.paidAt);
    const v = map.get(date) ?? { cents: 0, count: 0, guests: new Set<string>(), covers: 0 };
    v.cents += p.totalCents;
    v.count += 1;
    if (!v.guests.has(p.session.id)) {
      v.guests.add(p.session.id);
      v.covers += p.session.guests;
    }
    map.set(date, v);
  }

  const closed = days.length ? await closedDays(days[0], days[days.length - 1]) : new Map();

  const eventsByDay = new Map<string, string[]>();
  for (const e of analysis.data.events) {
    const { date } = jornadaOf(e.startsAt);
    eventsByDay.set(date, [...(eventsByDay.get(date) ?? []), e.title]);
  }

  return days.map((date) => {
    const v = map.get(date);
    return {
      jornada: date,
      dia: weekdayOf(date),
      total: money(v?.cents ?? 0),
      cobros: v?.count ?? 0,
      personas: v?.covers ?? 0,
      ticketPorPersona: v?.covers ? money(v.cents / v.covers) : 0,
      eventos: eventsByDay.get(date) ?? [],
      cerrado: closed.get(date) ?? null,
    };
  });
}

type DayRow = Awaited<ReturnType<typeof byJornada>>[number];

function hourly(analysis: Analysis) {
  const map = new Map<number, Tally>();
  for (const p of analysis.payments) {
    const { hour } = jornadaOf(p.paidAt);
    const v = map.get(hour) ?? { count: 0, cents: 0 };
    map.set(hour, { count: v.count + 1, cents: v.cents + p.totalCents });
  }
  const active = HOUR_ORDER.filter((h) => map.has(h));
  if (active.length === 0) return [];
  const first = HOUR_ORDER.indexOf(active[0]);
  const last = HOUR_ORDER.indexOf(active[active.length - 1]);
  return HOUR_ORDER.slice(first, last + 1).map((hour) => ({
    hora: hourLabel(hour),
    total: money(map.get(hour)?.cents ?? 0),
    cobros: map.get(hour)?.count ?? 0,
    porcentaje: pct(map.get(hour)?.cents ?? 0, analysis.totalCents),
  }));
}

/** Mapa de calor: dia de la semana por hora. Donde se concentra la plata. */
function heatmap(analysis: Analysis) {
  const cells = new Map<string, number>();
  const hours = new Set<number>();
  for (const p of analysis.payments) {
    const { weekday, hour } = jornadaOf(p.paidAt);
    const key = `${weekday}|${hour}`;
    cells.set(key, (cells.get(key) ?? 0) + p.totalCents);
    hours.add(hour);
  }
  const cols = HOUR_ORDER.filter((h) => hours.has(h));
  return [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => cols.some((h) => cells.has(`${d}|${h}`)))
    .map((d) => ({
      dia: DIAS[d],
      ...Object.fromEntries(cols.map((h) => [hourLabel(h), money(cells.get(`${d}|${h}`) ?? 0)])),
    }));
}

function weekdayAverages(days: DayRow[]) {
  const open = days.filter((d) => d.cobros > 0);
  const map = new Map<string, { cents: number; n: number; covers: number }>();
  for (const d of open) {
    const v = map.get(d.dia) ?? { cents: 0, n: 0, covers: 0 };
    map.set(d.dia, { cents: v.cents + d.total, n: v.n + 1, covers: v.covers + d.personas });
  }
  return [1, 2, 3, 4, 5, 6, 0]
    .map((i) => DIAS[i])
    .filter((dia) => map.has(dia))
    .map((dia) => {
      const v = map.get(dia)!;
      return {
        dia,
        jornadasConVenta: v.n,
        total: v.cents,
        promedioPorJornada: Math.round(v.cents / v.n),
        personasPromedio: Math.round(v.covers / v.n),
      };
    });
}

function eventImpact(analysis: Analysis, days: DayRow[]) {
  const open = days.filter((d) => d.cobros > 0);
  const withEvent = open.filter((d) => d.eventos.length > 0);
  const without = open.filter((d) => d.eventos.length === 0);
  const avg = (rows: DayRow[]) => (rows.length ? Math.round(sum(rows, (r) => r.total) / rows.length) : null);

  return {
    eventos: analysis.data.events.map((e) => {
      const date = jornadaOf(e.startsAt).date;
      const day = days.find((d) => d.jornada === date);
      const ratings = e.ratings.map((r) => r.rating);
      return {
        jornada: date,
        titulo: e.title,
        artista: e.artist,
        categoria: e.category,
        entrada: e.isFree ? "liberada" : e.priceCents ? money(e.priceCents) : "con valor",
        ventaDeLaJornada: day?.total ?? null,
        personas: day?.personas ?? null,
        calificacionPromedio: ratings.length ? round1(sum(ratings, (r) => r) / ratings.length) : null,
        calificaciones: ratings.length,
      };
    }),
    promedioJornadaConEvento: avg(withEvent),
    promedioJornadaSinEvento: avg(without),
    diferenciaPorcentaje: (() => {
      const a = avg(withEvent);
      const b = avg(without);
      return a !== null && b ? change(a, b) : null;
    })(),
  };
}

// --- Comparaciones -----------------------------------------------------------

async function periodTotals(start: Date, end: Date) {
  const payments = await prisma.payment.findMany({
    where: { paidAt: { gte: start, lt: end }, voidedAt: null },
    select: { totalCents: true, sessionId: true, session: { select: { guests: true } } },
  });
  const sessions = new Map(payments.map((p) => [p.sessionId, p.session.guests]));
  const covers = sum([...sessions.values()], (g) => g);
  const cents = sum(payments, (p) => p.totalCents);
  return { cents, count: payments.length, covers };
}

/**
 * Compara contra otro periodo. Si el actual sigue en curso, el otro se corta
 * a la misma altura: media noche contra una noche entera siempre parece caida.
 */
async function compareWith(
  current: { start: Date; end: Date; analysis: Analysis },
  other: { start: Date; end: Date; label: string },
) {
  const now = new Date();
  const inProgress = now < current.end;
  const end = inProgress
    ? new Date(other.start.getTime() + (now.getTime() - current.start.getTime()))
    : other.end;

  const before = await periodTotals(other.start, end);
  const a = current.analysis;

  return {
    contra: other.label,
    hastaLaMismaHora: inProgress,
    venta: money(before.cents),
    cobros: before.count,
    personas: before.covers,
    ticketPorPersona: before.covers ? money(before.cents / before.covers) : null,
    variacionVenta: change(a.totalCents, before.cents),
    variacionCobros: change(a.payments.length, before.count),
    variacionPersonas: change(a.covers, before.covers),
    variacionTicketPorPersona:
      before.covers && a.covers ? change(a.totalCents / a.covers, before.cents / before.covers) : null,
  };
}

// --- Contexto para leer las cifras -------------------------------------------

const criterios = [
  `Montos en ${process.env.NEXT_PUBLIC_CURRENCY ?? "CLP"}, sin decimales.`,
  `La jornada va de las ${INICIO_JORNADA}:00 a las ${INICIO_JORNADA}:00 del día siguiente (hora de ${TIME_ZONE}): lo cobrado de madrugada es de la noche anterior.`,
  "ventaTotal = lo cobrado, ya descontadas promociones de la carta y beneficios BarzuCard. ventaNetaSinIva descuenta el IVA incluido en los precios.",
  "Los cobros anulados no suman en ninguna cifra y se listan aparte.",
  "Productos, categorías, estaciones, garzones y costos cuentan solo lo cobrado en el periodo; su venta es antes de beneficios BarzuCard, que se aplican al total del cobro.",
  "personasAtendidas = comensales anotados al abrir la cuenta (una persona en cuentas de pie y ventas directas).",
  "porGarzon = quien cargó cada producto a la cuenta; porCajero = quien cobró.",
  "Pour cost = costo de lo vendido en barra / venta de barra; food cost = lo mismo en cocina. Solo con productos con costo cargado.",
  "Ingeniería de menú: ESTRELLA (popular y rentable: mantener y destacar), CABALLO_DE_BATALLA (popular, poco margen: subir precio o bajar costo), ENIGMA (rentable, poco pedido: promocionar o reubicar), PERRO (ni lo uno ni lo otro: reformular o sacar).",
  "`cerrado` trae el motivo cuando el día se marcó como cerrado en el panel: un cero ahí no es un mal día.",
];

const noDisponible = [
  "Propinas: se dejan en la terminal de pago, el POS no las registra.",
  "Costo de personal, horas trabajadas y prime cost: el sistema no guarda turnos ni sueldos.",
  "Inventario y merma real: no hay control de stock; las cancelaciones después de enviar son la mejor aproximación.",
  "Reservas y personas que no consumieron: solo se cuentan cuentas abiertas en el POS.",
];

export type ReportOptions = {
  /** Cuantos productos listar en los rankings. */
  top?: number;
  /** Meta de venta del periodo, en pesos. */
  meta?: number;
};

function goal(meta: number | undefined, totalCents: number, remainingDays: number | null) {
  if (!meta) return null;
  const missing = Math.max(0, meta * 100 - totalCents);
  return {
    meta,
    cumplimientoPorcentaje: pct(totalCents, meta * 100),
    falta: money(missing),
    necesarioPorJornadaRestante: remainingDays ? money(missing / remainingDays) : null,
  };
}

// --- Informes ----------------------------------------------------------------

export async function dailyReport(date: string, { top = 15, meta }: ReportOptions = {}) {
  const { start, end } = dayRange(date);
  const analysis = await analyze(start, end, top);
  const now = new Date();
  const enCurso = now >= start && now < end;

  const porHora = hourly(analysis);
  const peak = [...porHora].sort((a, b) => b.total - a.total)[0] ?? null;

  // Un bar se compara contra el mismo dia de la semana: un martes contra un
  // lunes no dice nada. Contra la semana pasada y contra el promedio de las
  // cuatro anteriores, que aguanta mejor una noche rara.
  const lastWeek = shiftDay(date, -7);
  const fourWeeks = await Promise.all(
    [7, 14, 21, 28].map((d) => {
      const r = dayRange(shiftDay(date, -d));
      return periodTotals(r.start, r.end);
    }),
  );
  const withSales = fourWeeks.filter((w) => w.count > 0);
  const avg4 = withSales.length ? sum(withSales, (w) => w.cents) / withSales.length : 0;

  let cuentasAbiertas = null;
  if (enCurso) {
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
      pendientePorCobrar: money(sum(open, (s) => sum(s.items, (i) => lineTotal(i)))),
    };
  }

  const eventos = analysis.data.events.map((e) => ({
    titulo: e.title,
    artista: e.artist,
    categoria: e.category,
    inicio: e.startsAt.toISOString(),
    calificacionPromedio: e.ratings.length
      ? round1(sum(e.ratings, (r) => r.rating) / e.ratings.length)
      : null,
  }));

  return {
    tipo: "diario",
    jornada: date,
    diaDeLaSemana: weekdayOf(date),
    desde: start.toISOString(),
    hasta: end.toISOString(),
    enCurso,
    cerrado: (await closedDays(date, date)).get(date) ?? null,
    eventos,
    ...analysis.report,
    porHora,
    horaPeak: peak && peak.total > 0 ? peak : null,
    cuentasAbiertas,
    meta: goal(meta, analysis.totalCents, enCurso ? 1 : null),
    comparaciones: {
      mismoDiaSemanaAnterior: await compareWith(
        { start, end, analysis },
        { ...dayRange(lastWeek), label: `${weekdayOf(lastWeek)} ${lastWeek}` },
      ),
      promedioUltimas4Semanas: {
        contra: `promedio de los últimos ${withSales.length} ${weekdayOf(date)} con venta`,
        venta: money(avg4),
        variacionVenta: change(analysis.totalCents, avg4),
      },
    },
    criterios,
    noDisponible,
  };
}

export async function monthlyReport(month: string, { top = 20, meta }: ReportOptions = {}) {
  const { start, end } = monthRange(month);
  const analysis = await analyze(start, end, top);
  const now = new Date();
  const enCurso = now >= start && now < end;

  const today = currentJornada();
  const allDays: string[] = [];
  for (let d = `${month}-01`; d.startsWith(month); d = shiftDay(d, 1)) allDays.push(d);
  const elapsed = allDays.filter((d) => d <= today);

  const porDia = await byJornada(analysis, elapsed);
  const open = porDia.filter((d) => d.cobros > 0);
  const sorted = [...open].sort((a, b) => b.total - a.total);

  // Proyeccion: el promedio de cada dia de la semana, aplicado a los dias que
  // faltan. Respeta que un sabado no vale lo mismo que un martes.
  let proyeccion = null;
  if (enCurso) {
    const byWeekday = weekdayAverages(porDia);
    const remaining = allDays.filter((d) => d > today);
    const avgAll = open.length ? sum(open, (d) => d.total) / open.length : 0;
    const openRatio = elapsed.length ? open.length / elapsed.length : 0;
    const expected = sum(remaining, (d) => {
      const w = byWeekday.find((x) => x.dia === weekdayOf(d));
      return w ? w.promedioPorJornada * (w.jornadasConVenta / Math.max(1, elapsed.filter((e) => weekdayOf(e) === w.dia).length)) : avgAll * openRatio;
    });
    proyeccion = {
      jornadasRestantes: remaining.length,
      ventaEsperadaRestante: Math.round(expected),
      cierreProyectado: money(analysis.totalCents) + Math.round(expected),
      metodo: "promedio de cada día de la semana en lo que va del mes, ponderado por cuántos de esos días se abrió",
    };
  }

  const previous = shiftMonth(month, -1);
  const lastYear = shiftMonth(month, -12);

  return {
    tipo: "mensual",
    mes: month,
    desde: start.toISOString(),
    hasta: end.toISOString(),
    enCurso,
    ...analysis.report,
    jornadas: {
      transcurridas: elapsed.length,
      conVenta: open.length,
      cerradas: porDia.filter((d) => d.cerrado).length,
      promedioPorJornada: open.length ? money(analysis.totalCents / open.length) : 0,
      mejor: sorted[0] ?? null,
      peor: sorted[sorted.length - 1] ?? null,
    },
    porDia,
    porDiaDeLaSemana: weekdayAverages(porDia),
    porHora: hourly(analysis),
    mapaDeCalor: heatmap(analysis),
    eventosEImpacto: eventImpact(analysis, porDia),
    proyeccion,
    meta: goal(meta, analysis.totalCents, enCurso ? allDays.filter((d) => d > today).length : null),
    comparaciones: {
      mesAnterior: await compareWith({ start, end, analysis }, { ...monthRange(previous), label: previous }),
      mismoMesAnoAnterior: await compareWith({ start, end, analysis }, { ...monthRange(lastYear), label: lastYear }),
    },
    criterios,
    noDisponible,
  };
}

/** Entre dos jornadas: semanas o tramos a medida. */
export async function rangeReport(from: string, to: string, { top = 15, meta }: ReportOptions = {}) {
  const start = dayRange(from).start;
  const end = dayRange(to).end;
  const analysis = await analyze(start, end, top);

  const days: string[] = [];
  for (let d = from; d <= to; d = shiftDay(d, 1)) days.push(d);
  const porDia = await byJornada(analysis, days);
  const open = porDia.filter((d) => d.cobros > 0);

  // El mismo tramo inmediatamente antes, del mismo largo.
  const prevFrom = shiftDay(from, -days.length);
  const prevTo = shiftDay(from, -1);

  return {
    tipo: "rango",
    desdeJornada: from,
    hastaJornada: to,
    desde: start.toISOString(),
    hasta: end.toISOString(),
    ...analysis.report,
    jornadas: {
      total: days.length,
      conVenta: open.length,
      promedioPorJornada: open.length ? money(analysis.totalCents / open.length) : 0,
    },
    porDia,
    porDiaDeLaSemana: weekdayAverages(porDia),
    porHora: hourly(analysis),
    mapaDeCalor: heatmap(analysis),
    eventosEImpacto: eventImpact(analysis, porDia),
    meta: goal(meta, analysis.totalCents, null),
    comparaciones: {
      tramoAnterior: await compareWith(
        { start, end, analysis },
        { start: dayRange(prevFrom).start, end: dayRange(prevTo).end, label: `${prevFrom} a ${prevTo}` },
      ),
    },
    criterios,
    noDisponible,
  };
}

/**
 * Cada cobro de una jornada, uno por uno: para cuadrar la caja o revisar un
 * reclamo.
 */
export async function paymentsDetail(date: string) {
  const { start, end } = dayRange(date);
  const payments = await prisma.payment.findMany({
    where: { paidAt: { gte: start, lt: end } },
    orderBy: { paidAt: "asc" },
    select: {
      code: true,
      paidAt: true,
      method: true,
      subtotalCents: true,
      discountCents: true,
      totalCents: true,
      voidedAt: true,
      voidReason: true,
      cardId: true,
      cashier: { select: { name: true } },
      diner: { select: { label: true } },
      session: {
        select: {
          code: true,
          kind: true,
          label: true,
          table: { select: { number: true, name: true } },
        },
      },
      items: {
        select: { name: true, variant: true, quantity: true, unitPriceCents: true, discountCents: true },
      },
    },
  });

  return {
    jornada: date,
    cobros: payments.map((p) => ({
      comprobante: p.code,
      hora: formatTime(p.paidAt),
      cuenta: sessionTitle(p.session),
      codigoCuenta: p.session.code,
      comensal: p.diner?.label ?? null,
      metodo: p.method,
      subtotal: money(p.subtotalCents),
      descuento: money(p.discountCents),
      total: money(p.totalCents),
      conBarzuCard: !!p.cardId,
      cajero: p.cashier?.name ?? null,
      anulado: p.voidedAt ? { motivo: p.voidReason } : null,
      productos: p.items.map((i) => ({
        nombre: i.variant ? `${i.name} (${i.variant})` : i.name,
        unidades: i.quantity,
        total: money(lineTotal(i)),
      })),
    })),
  };
}
