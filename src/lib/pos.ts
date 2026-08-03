import "server-only";

import { randomInt } from "node:crypto";

import type { Station } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * POS de sala: precios, cuentas y estado de las mesas.
 *
 * Todo lo que lee el garzon sale de aca. Las escrituras viven en
 * `app/actions/pos.ts`.
 *
 * Regla de oro del modulo: la carta manda. El precio, el descuento y la
 * estacion de impresion se derivan de lo que esta publicado en la web, para
 * que no exista una segunda lista de precios que mantener.
 */

// --- Precios -----------------------------------------------------------------

export type PricedProduct = {
  unitPriceCents: number;
  /** Rebaja por unidad. 0 si el producto esta a precio de lista. */
  discountCents: number;
  discountLabel: string | null;
};

type PromoFields = {
  priceCents: number;
  promoPriceCents: number | null;
  promoLabel: string | null;
  promoStartsAt: Date | null;
  promoEndsAt: Date | null;
};

/**
 * Precio vigente de un producto.
 *
 * El descuento se guarda aparte del precio de lista en vez de reemplazarlo:
 * asi la boleta puede mostrar "antes / ahora" y el cierre de caja sabe cuanto
 * se resigno en promociones.
 */
export function priceFor(product: PromoFields, now = new Date()): PricedProduct {
  const promo = product.promoPriceCents;

  const vigente =
    promo !== null &&
    promo >= 0 &&
    promo < product.priceCents &&
    (!product.promoStartsAt || product.promoStartsAt <= now) &&
    (!product.promoEndsAt || product.promoEndsAt >= now);

  if (!vigente) {
    return {
      unitPriceCents: product.priceCents,
      discountCents: 0,
      discountLabel: null,
    };
  }

  return {
    unitPriceCents: product.priceCents,
    discountCents: product.priceCents - promo,
    discountLabel: product.promoLabel?.trim() || "Promo",
  };
}

/** Estacion de impresion: la del producto si la tiene, si no la de su categoria. */
export function stationFor(product: {
  station: Station | null;
  category: { station: Station };
}): Station {
  return product.station ?? product.category.station;
}

/**
 * Puntos de BarzuCard que otorga un consumo: 1 por cada $1.000 cobrados.
 *
 * Es la via realista para subir de nivel. Solo con canjes harian falta decenas
 * de visitas, asi que la tarjeta no tenia motivo para salir de la billetera.
 * Se calcula sobre lo efectivamente cobrado, ya con descuentos aplicados.
 */
export function pointsForSpend(totalCents: number) {
  return Math.floor(totalCents / 100_000);
}

/** Lo que se cobra por una linea, ya con su descuento y su cantidad. */
export function lineTotal(item: {
  unitPriceCents: number;
  discountCents: number;
  quantity: number;
}) {
  return (item.unitPriceCents - item.discountCents) * item.quantity;
}

// --- Carta para el garzon ----------------------------------------------------

export type PosMenuProduct = {
  id: string;
  name: string;
  station: Station;
  unitPriceCents: number;
  discountCents: number;
  discountLabel: string | null;
};

export type PosMenuCategory = {
  id: string;
  name: string;
  station: Station;
  products: PosMenuProduct[];
};

/**
 * La carta tal como la ve el garzon.
 *
 * Es la misma consulta que alimenta la web publica, filtrada por disponible:
 * un producto nuevo aparece en el POS sin que nadie lo cargue de nuevo, y uno
 * agotado desaparece de las dos partes a la vez.
 */
export async function getPosMenu(now = new Date()): Promise<PosMenuCategory[]> {
  const categories = await prisma.menuCategory.findMany({
    where: { active: true },
    orderBy: { position: "asc" },
    include: {
      products: {
        where: { available: true },
        orderBy: [{ position: "asc" }, { name: "asc" }],
      },
    },
  });

  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      station: category.station,
      products: category.products.map((product) => {
        const priced = priceFor(product, now);

        return {
          id: product.id,
          name: product.name,
          station: product.station ?? category.station,
          unitPriceCents: priced.unitPriceCents,
          discountCents: priced.discountCents,
          discountLabel: priced.discountLabel,
        };
      }),
    }))
    .filter((category) => category.products.length > 0);
}

// --- Mesas -------------------------------------------------------------------

export type TableOverview = {
  id: string;
  number: number;
  name: string | null;
  zone: string | null;
  seats: number;
  session: {
    id: string;
    code: string;
    openedAt: string;
    guests: number;
    diners: number;
    /** Lineas cargadas que todavia no salieron en ninguna comanda. */
    draftItems: number;
    pendingCents: number;
  } | null;
};

/** Estado de todas las mesas activas: lo primero que ve el garzon al entrar. */
export async function getTablesOverview(): Promise<TableOverview[]> {
  const tables = await prisma.posTable.findMany({
    where: { active: true },
    orderBy: [{ position: "asc" }, { number: "asc" }],
    include: {
      sessions: {
        where: { status: "OPEN" },
        orderBy: { openedAt: "desc" },
        take: 1,
        include: {
          diners: { select: { id: true } },
          items: {
            where: { status: { not: "CANCELLED" } },
            select: {
              status: true,
              paymentId: true,
              unitPriceCents: true,
              discountCents: true,
              quantity: true,
            },
          },
        },
      },
    },
  });

  return tables.map((table) => {
    const session = table.sessions[0];

    return {
      id: table.id,
      number: table.number,
      name: table.name,
      zone: table.zone,
      seats: table.seats,
      session: session
        ? {
            id: session.id,
            code: session.code,
            openedAt: session.openedAt.toISOString(),
            guests: session.guests,
            diners: session.diners.length,
            draftItems: session.items.filter((item) => item.status === "DRAFT")
              .length,
            pendingCents: session.items
              .filter((item) => item.paymentId === null)
              .reduce((total, item) => total + lineTotal(item), 0),
          }
        : null,
    };
  });
}

// --- Cuenta ------------------------------------------------------------------

export type AccountItem = {
  id: string;
  name: string;
  note: string | null;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  discountLabel: string | null;
  totalCents: number;
  station: Station;
  status: "DRAFT" | "SENT" | "CANCELLED";
  paid: boolean;
  dinerId: string | null;
};

export type AccountTab = {
  /** null = la cuenta compartida de la mesa. */
  dinerId: string | null;
  label: string;
  color: string | null;
  items: AccountItem[];
  pendingCents: number;
  paidCents: number;
};

export type SessionDetail = {
  id: string;
  code: string;
  status: "OPEN" | "CLOSED";
  guests: number;
  note: string | null;
  openedAt: string;
  table: { id: string; number: number; name: string | null };
  diners: Array<{ id: string; label: string; color: string | null }>;
  tabs: AccountTab[];
  draftCount: number;
  pendingCents: number;
  paidCents: number;
  payments: Array<{
    id: string;
    code: string;
    dinerLabel: string | null;
    totalCents: number;
    method: string;
    paidAt: string;
  }>;
  tickets: Array<{
    id: string;
    number: number;
    station: Station;
    status: string;
    createdAt: string;
    lastError: string | null;
  }>;
};

/**
 * La cuenta completa de una mesa, ya repartida por comensal.
 *
 * Se devuelve armada en "tabs" —una por comensal mas la de la mesa— porque es
 * exactamente como se ve en el telefono y como se cobra: cada pestana se
 * puede cerrar sola.
 */
export async function getSessionDetail(
  sessionId: string,
): Promise<SessionDetail | null> {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      table: { select: { id: true, number: true, name: true } },
      diners: { orderBy: { position: "asc" } },
      items: { orderBy: { createdAt: "asc" } },
      payments: {
        orderBy: { paidAt: "desc" },
        include: { diner: { select: { label: true } } },
      },
      tickets: { orderBy: { number: "desc" }, take: 12 },
    },
  });

  if (!session) return null;

  const toAccountItem = (item: (typeof session.items)[number]): AccountItem => ({
    id: item.id,
    name: item.name,
    note: item.note,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    discountCents: item.discountCents,
    discountLabel: item.discountLabel,
    totalCents: lineTotal(item),
    station: item.station,
    status: item.status,
    paid: item.paymentId !== null,
    dinerId: item.dinerId,
  });

  const vivos = session.items.filter((item) => item.status !== "CANCELLED");

  const buildTab = (
    dinerId: string | null,
    label: string,
    color: string | null,
  ): AccountTab => {
    const items = vivos
      .filter((item) => item.dinerId === dinerId)
      .map(toAccountItem);

    return {
      dinerId,
      label,
      color,
      items,
      pendingCents: items
        .filter((item) => !item.paid)
        .reduce((total, item) => total + item.totalCents, 0),
      paidCents: items
        .filter((item) => item.paid)
        .reduce((total, item) => total + item.totalCents, 0),
    };
  };

  const tabs: AccountTab[] = [
    buildTab(null, "De la mesa", null),
    ...session.diners.map((diner) => buildTab(diner.id, diner.label, diner.color)),
  ];

  return {
    id: session.id,
    code: session.code,
    status: session.status,
    guests: session.guests,
    note: session.note,
    openedAt: session.openedAt.toISOString(),
    table: session.table,
    diners: session.diners.map((diner) => ({
      id: diner.id,
      label: diner.label,
      color: diner.color,
    })),
    tabs,
    draftCount: vivos.filter((item) => item.status === "DRAFT").length,
    pendingCents: tabs.reduce((total, tab) => total + tab.pendingCents, 0),
    paidCents: tabs.reduce((total, tab) => total + tab.paidCents, 0),
    payments: session.payments.map((payment) => ({
      id: payment.id,
      code: payment.code,
      dinerLabel: payment.diner?.label ?? null,
      totalCents: payment.totalCents,
      method: payment.method,
      paidAt: payment.paidAt.toISOString(),
    })),
    tickets: session.tickets.map((ticket) => ({
      id: ticket.id,
      number: ticket.number,
      station: ticket.station,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
      lastError: ticket.lastError,
    })),
  };
}

/** Etiquetas de estacion, para no repetir el switch en cada pantalla. */
export const STATION_LABELS: Record<Station, string> = {
  BARRA: "Barra",
  COCINA: "Cocina",
};

// --- Codigos -----------------------------------------------------------------

/** Sin I, O, 0 ni 1: estos codigos se dictan en voz alta en un local ruidoso. */
const READABLE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function readable(length: number) {
  let code = "";
  for (let i = 0; i < length; i++) code += READABLE[randomInt(0, READABLE.length)];
  return code;
}

/** Nombre del turno de mesa: "M4-K7P2". Se canta entre garzones. */
export function generateSessionCode(tableNumber: number) {
  return `M${tableNumber}-${readable(4)}`;
}

/** Comprobante del cobro: "BZC-4K7P2M". */
export function generatePaymentCode() {
  return `BZC-${readable(6)}`;
}
