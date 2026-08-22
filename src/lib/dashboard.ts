import "server-only";

import type { Station } from "@/generated/prisma/enums";
import { originLabel, zonedHour, zonedStartOfHour } from "@/lib/format";
import { lineTotal } from "@/lib/pos";
import { prisma } from "@/lib/prisma";

/**
 * El servicio en vivo, para quien administra el local.
 *
 * Responde lo que se pregunta caminando por el salon a las once de la noche:
 * como va la venta, que se esta demorando, que mesa lleva mucho rato y que se
 * esta vendiendo. Todo de la jornada en curso y calculado en cada visita: es
 * una pantalla que se mira ahora, no un informe.
 *
 * El cierre del dia —lo que se cuadra al apagar las luces— vive aparte, en
 * /admin/caja.
 */

/** A que hora del reloj del local empieza la jornada. */
const INICIO_JORNADA = 6;

/**
 * Cuando empieza la jornada.
 *
 * A las seis de la manana, no a medianoche. Un bar que cierra a las tres tiene
 * la mitad de su noche despues de las doce, y partir el servicio al medio
 * dejaria al encargado mirando una pantalla en cero justo cuando el local esta
 * mas lleno.
 *
 * Las seis son las del local, no las del servidor: en produccion el servidor
 * corre en UTC y ahi el corte caeria a las dos de la manana en Chile, que es
 * exactamente el momento que no hay que cortar.
 */
export function serviceStart(now = new Date()) {
  const hoy = zonedStartOfHour(now, INICIO_JORNADA);

  return now >= hoy ? hoy : zonedStartOfHour(now, INICIO_JORNADA, 1);
}

/** Cuando una comanda pendiente deja de ser normal. Igual que en la pantalla
 * de la estacion, para que las dos digan lo mismo. */
const DEMORA_AVISO_MIN = 8;
const DEMORA_GRAVE_MIN = 15;

/** Una mesa que lleva mucho tiempo abierta sin que nadie le cobre. */
const MESA_LARGA_MIN = 150;

/** Mesa abierta y todavia sin nada cargado: nadie le tomo el pedido. */
const MESA_SIN_PEDIR_MIN = 20;

/** Productos cargados que el garzon nunca mando a la estacion. */
const SIN_ENVIAR_MIN = 5;

export type Alert = {
  id: string;
  level: "grave" | "aviso";
  title: string;
  detail: string;
  href?: string;
};

export type LiveService = {
  /** Inicio de la jornada, para poder decirlo en pantalla. */
  since: string;

  sales: {
    totalCents: number;
    payments: number;
    /** Precios promocionales y beneficios ya aplicados en los cobros. */
    discountCents: number;
    /** Consumo cargado en mesas abiertas que todavia nadie pago. */
    openCents: number;
    /** Promedio por cobro de la jornada. */
    averageTicketCents: number;
    byMethod: Array<{ method: string; cents: number; count: number }>;
    byStation: Record<Station, number>;
    /** Una entrada por hora transcurrida de la jornada. */
    byHour: Array<{ hour: number; cents: number }>;
    byCashier: Array<{ name: string; cents: number; count: number }>;
  };

  room: {
    tables: number;
    open: number;
    guests: number;
    /** Mesas atendidas en la jornada (abiertas y cerradas). */
    served: number;
  };

  kitchen: {
    /** Comandas que siguen esperando que alguien las retire. */
    pending: Array<{
      id: string;
      number: number;
      station: Station;
      tableNumber: number | null;
      minutes: number;
      items: number;
    }>;
    /** Minutos promedio entre mandar la comanda y retirarla, en la jornada. */
    averageMinutes: number | null;
    /** La peor espera de la jornada, ya resuelta. */
    worstMinutes: number | null;
    /** Comandas retiradas en la jornada: la base del promedio. */
    served: number;
    /** Comandas que la impresora rechazo. */
    failedPrints: number;
  };

  products: Array<{
    name: string;
    station: Station;
    quantity: number;
    cents: number;
  }>;

  alerts: Alert[];
};

export async function getLiveService(): Promise<LiveService> {
  const now = new Date();
  const since = serviceStart(now);

  const [payments, items, sessions, pendingTickets, servedTickets, failedPrints, tables] =
    await Promise.all([
      prisma.payment.findMany({
        where: { paidAt: { gte: since } },
        select: {
          totalCents: true,
          discountCents: true,
          method: true,
          paidAt: true,
          cashier: { select: { name: true } },
        },
      }),

      // Todo lo consumido en la jornada, cobrado o no: es lo que de verdad
      // salio de la cocina y de la barra.
      prisma.orderItem.findMany({
        where: { status: { not: "CANCELLED" }, createdAt: { gte: since } },
        select: {
          name: true,
          station: true,
          quantity: true,
          unitPriceCents: true,
          discountCents: true,
        },
      }),

      prisma.tableSession.findMany({
        where: { OR: [{ status: "OPEN" }, { openedAt: { gte: since } }] },
        select: {
          id: true,
          status: true,
          kind: true,
          openedAt: true,
          guests: true,
          table: { select: { number: true } },
          items: {
            where: { status: { not: "CANCELLED" } },
            select: {
              status: true,
              paymentId: true,
              unitPriceCents: true,
              discountCents: true,
              quantity: true,
              createdAt: true,
            },
          },
        },
      }),

      prisma.orderTicket.findMany({
        where: { kind: "COMANDA", prep: "PENDIENTE", createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          number: true,
          station: true,
          createdAt: true,
          session: { select: { table: { select: { number: true } } } },
          _count: { select: { items: true } },
        },
      }),

      prisma.orderTicket.findMany({
        where: {
          kind: "COMANDA",
          prep: "RETIRADA",
          createdAt: { gte: since },
          pickedUpAt: { not: null },
        },
        select: { createdAt: true, pickedUpAt: true },
      }),

      prisma.orderTicket.count({
        where: { status: "FAILED", createdAt: { gte: since } },
      }),

      prisma.posTable.count({ where: { active: true } }),
    ]);

  const minutesSince = (date: Date) =>
    Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));

  // --- Venta -----------------------------------------------------------------

  const totalCents = payments.reduce((total, p) => total + p.totalCents, 0);
  const discountCents = payments.reduce((total, p) => total + p.discountCents, 0);

  const methods = new Map<string, { cents: number; count: number }>();
  const cashiers = new Map<string, { cents: number; count: number }>();
  const hours = new Map<number, number>();

  for (const payment of payments) {
    const method = methods.get(payment.method) ?? { cents: 0, count: 0 };
    methods.set(payment.method, {
      cents: method.cents + payment.totalCents,
      count: method.count + 1,
    });

    const name = payment.cashier?.name ?? "Sin registrar";
    const cashier = cashiers.get(name) ?? { cents: 0, count: 0 };
    cashiers.set(name, {
      cents: cashier.cents + payment.totalCents,
      count: cashier.count + 1,
    });

    const hour = zonedHour(payment.paidAt);
    hours.set(hour, (hours.get(hour) ?? 0) + payment.totalCents);
  }

  /*
   * Las horas de la jornada, incluidas las que no vendieron nada.
   *
   * Sin los ceros el grafico miente: dos barras pegadas parecen dos horas
   * seguidas aunque entre medio haya un bache de tres horas sin una venta,
   * que es justo lo que el encargado necesita ver.
   */
  const byHour: Array<{ hour: number; cents: number }> = [];
  const horasTranscurridas =
    Math.floor((now.getTime() - since.getTime()) / 3_600_000) + 1;

  for (let i = 0; i < horasTranscurridas; i += 1) {
    const hour = (INICIO_JORNADA + i) % 24;
    byHour.push({ hour, cents: hours.get(hour) ?? 0 });
  }

  // --- Consumo y productos ---------------------------------------------------

  const byStation: Record<Station, number> = { BARRA: 0, COCINA: 0 };
  const productos = new Map<
    string,
    { station: Station; quantity: number; cents: number }
  >();

  for (const item of items) {
    const cents = lineTotal(item);
    byStation[item.station] += cents;

    const current = productos.get(item.name) ?? {
      station: item.station,
      quantity: 0,
      cents: 0,
    };
    productos.set(item.name, {
      station: item.station,
      quantity: current.quantity + item.quantity,
      cents: current.cents + cents,
    });
  }

  // --- Sala ------------------------------------------------------------------

  const abiertas = sessions.filter((session) => session.status === "OPEN");

  const openCents = abiertas.reduce(
    (total, session) =>
      total +
      session.items
        .filter((item) => item.paymentId === null)
        .reduce((sum, item) => sum + lineTotal(item), 0),
    0,
  );

  // --- Cocina ----------------------------------------------------------------

  const pending = pendingTickets.map((ticket) => ({
    id: ticket.id,
    number: ticket.number,
    station: ticket.station!,
    tableNumber: ticket.session.table?.number ?? null,
    minutes: minutesSince(ticket.createdAt),
    items: ticket._count.items,
  }));

  const esperas = servedTickets.map((ticket) =>
    Math.max(
      0,
      Math.round(
        (ticket.pickedUpAt!.getTime() - ticket.createdAt.getTime()) / 60000,
      ),
    ),
  );

  const averageMinutes =
    esperas.length > 0
      ? Math.round(esperas.reduce((total, m) => total + m, 0) / esperas.length)
      : null;

  // --- Avisos ----------------------------------------------------------------

  const alerts: Alert[] = [];

  for (const ticket of pending) {
    if (ticket.minutes < DEMORA_AVISO_MIN) continue;

    alerts.push({
      id: `comanda-${ticket.id}`,
      level: ticket.minutes >= DEMORA_GRAVE_MIN ? "grave" : "aviso",
      title: `${originLabel(ticket.tableNumber === null ? null : { number: ticket.tableNumber })} espera hace ${ticket.minutes} min`,
      detail: `Comanda #${ticket.number} en ${ticket.station === "BARRA" ? "barra" : "cocina"}, ${ticket.items} producto(s) sin retirar.`,
      href: ticket.station === "BARRA" ? "/staff/barra" : "/staff/cocina",
    });
  }

  for (const session of abiertas) {
    const minutos = minutesSince(session.openedAt);

    const sinCobrar = session.items
      .filter((item) => item.paymentId === null)
      .reduce((sum, item) => sum + lineTotal(item), 0);

    if (session.items.length === 0 && minutos >= MESA_SIN_PEDIR_MIN) {
      alerts.push({
        id: `sin-pedir-${session.id}`,
        level: "aviso",
        title: `${originLabel(session.table)} lleva ${minutos} min sin pedir nada`,
        detail: "Se abrió y no tiene ni un producto cargado.",
        href: `/staff/pos/${session.id}`,
      });
      continue;
    }

    // Cargado y nunca enviado: lo que la cocina no sabe que existe.
    const sinEnviar = session.items.filter(
      (item) =>
        item.status === "DRAFT" && minutesSince(item.createdAt) >= SIN_ENVIAR_MIN,
    ).length;

    if (sinEnviar > 0) {
      alerts.push({
        id: `sin-enviar-${session.id}`,
        level: "grave",
        title: `${originLabel(session.table)}: ${sinEnviar} producto(s) sin mandar`,
        detail: "Están cargados hace rato y la estación todavía no los vio.",
        href: `/staff/pos/${session.id}`,
      });
    }

    if (minutos >= MESA_LARGA_MIN && sinCobrar > 0) {
      alerts.push({
        id: `mesa-larga-${session.id}`,
        level: "aviso",
        title: `${originLabel(session.table)} abierta hace ${Math.floor(minutos / 60)} h ${minutos % 60} min`,
        detail: "Sigue con consumo sin cobrar.",
        href: `/staff/pos/${session.id}`,
      });
    }
  }

  if (failedPrints > 0) {
    alerts.push({
      id: "impresion",
      level: "grave",
      title: `${failedPrints} comanda(s) no se pudieron imprimir`,
      detail: "Revisa el papel y la conexión de la impresora del local.",
    });
  }

  // Lo mas urgente arriba, y dentro de cada nivel lo que llego primero.
  alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === "grave" ? -1 : 1));

  return {
    since: since.toISOString(),

    sales: {
      totalCents,
      payments: payments.length,
      discountCents,
      openCents,
      averageTicketCents:
        payments.length > 0 ? Math.round(totalCents / payments.length) : 0,
      byMethod: [...methods.entries()]
        .map(([method, data]) => ({ method, ...data }))
        .sort((a, b) => b.cents - a.cents),
      byStation,
      byHour,
      byCashier: [...cashiers.entries()]
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.cents - a.cents),
    },

    room: {
      tables,
      open: abiertas.length,
      guests: abiertas.reduce((total, session) => total + session.guests, 0),
      // Mesas, no ventas: lo de mostrador no ocupa ninguna y contarlo aca
      // inflaria la unica cifra que dice que tan llena estuvo la sala.
      served: sessions.filter((session) => session.kind === "MESA").length,
    },

    kitchen: {
      pending,
      averageMinutes,
      worstMinutes: esperas.length > 0 ? Math.max(...esperas) : null,
      served: esperas.length,
      failedPrints,
    },

    products: [...productos.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 12),

    alerts,
  };
}
