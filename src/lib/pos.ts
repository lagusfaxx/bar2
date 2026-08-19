import "server-only";

import { randomInt } from "node:crypto";

import type { Station, TicketKind } from "@/generated/prisma/enums";
import { checkEligibility } from "@/lib/barzucard";
import { prisma } from "@/lib/prisma";
import {
  requirementLabel,
  resolvePromotion,
  type PromoLine,
} from "@/lib/promotions";

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

/**
 * Lo que mas se vende, para ponerlo primero.
 *
 * En un bar lleno el garzon no puede buscar: el 80% de los pedidos son los
 * mismos veinte productos. Tenerlos a un toque, sin scroll ni teclado, es la
 * diferencia entre cargar un pedido en cinco segundos o en treinta.
 */
export async function getFrequentProducts(
  limit = 12,
  days = 14,
): Promise<PosMenuProduct[]> {
  const desde = new Date();
  desde.setDate(desde.getDate() - days);

  const ranking = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      createdAt: { gte: desde },
      status: { not: "CANCELLED" },
      productId: { not: null },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  const ids = ranking
    .map((row) => row.productId)
    .filter((id): id is string => id !== null);

  if (ids.length === 0) return [];

  const products = await prisma.menuProduct.findMany({
    where: { id: { in: ids }, available: true },
    include: { category: { select: { station: true } } },
  });

  const now = new Date();
  const porId = new Map(products.map((product) => [product.id, product]));

  // Se respeta el orden del ranking, que es lo que hace util a la lista.
  return ids
    .map((id) => porId.get(id))
    .filter((product): product is NonNullable<typeof product> => !!product)
    .map((product) => {
      const priced = priceFor(product, now);

      return {
        id: product.id,
        name: product.name,
        station: stationFor(product),
        unitPriceCents: priced.unitPriceCents,
        discountCents: priced.discountCents,
        discountLabel: priced.discountLabel,
      };
    });
}

// --- Pantallas de cocina y barra ---------------------------------------------

export type BoardTicket = {
  id: string;
  number: number;
  tableNumber: number;
  tableName: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    quantity: number;
    name: string;
    note: string | null;
    diner: string | null;
  }>;
};

/**
 * Las comandas pendientes de una estacion, tal como se ven en su pantalla.
 *
 * Todas las que devuelve estan pendientes: la pantalla de cocina no tiene
 * estados ni botones —nadie ahi tiene las manos limpias para tocarla—, asi que
 * una comanda esta o no esta. Desaparece cuando el garzon marca que se la
 * llevo, desde su telefono.
 *
 * Solo el servicio en curso: se mira desde seis horas atras para no arrastrar
 * la noche anterior.
 */
export async function getStationBoard(
  station: Station,
  hours = 6,
): Promise<BoardTicket[]> {
  const desde = new Date();
  desde.setHours(desde.getHours() - hours);

  const tickets = await prisma.orderTicket.findMany({
    where: {
      kind: "COMANDA",
      station,
      createdAt: { gte: desde },
      prep: "PENDIENTE",
    },
    // La mas vieja primero: es el orden en que hay que sacarlas y el unico que
    // no obliga a leer los relojes de toda la pantalla para saber por cual ir.
    orderBy: { createdAt: "asc" },
    include: {
      session: {
        select: { table: { select: { number: true, name: true } } },
      },
      items: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "asc" },
        include: { diner: { select: { label: true } } },
      },
    },
  });

  return tickets
    // Una comanda cuyas lineas se anularon todas ya no tiene nada que preparar.
    .filter((ticket) => ticket.items.length > 0)
    .map((ticket) => ({
      id: ticket.id,
      number: ticket.number,
      tableNumber: ticket.session.table.number,
      tableName: ticket.session.table.name,
      createdAt: ticket.createdAt.toISOString(),
      items: ticket.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        name: item.name,
        note: item.note,
        diner: item.diner?.label ?? null,
      })),
    }));
}

// --- Mesas -------------------------------------------------------------------

export type ZoneSummary = {
  id: string;
  name: string;
  color: string | null;
};

export type TableOverview = {
  id: string;
  number: number;
  name: string | null;
  zone: ZoneSummary | null;
  seats: number;
  session: {
    id: string;
    code: string;
    openedAt: string;
    guests: number;
    diners: number;
    /** Quien esta atendiendo la mesa ahora. */
    waiter: { id: string; name: string } | null;
    /** Etiqueta de la mesa, tal como se escribio: "Cumpleaños", "Reservada". */
    tag: string | null;
    /** Clave de color de esa etiqueta (ver TAG_COLORS). */
    tagColor: string | null;
    /** Lineas cargadas que todavia no salieron en ninguna comanda. */
    draftItems: number;
    /** A donde iria ese pedido si se mandara ahora. Vacio si no hay nada. */
    draftStations: Station[];
    /** Comandas que siguen en la estacion, esperando que alguien las retire. */
    pendingTickets: number;
    pendingCents: number;
  } | null;
};

/**
 * Los garzones entre los que se reparte la sala.
 *
 * Es la lista que se abre para decir quien atiende una mesa. Van todos los
 * usuarios activos del panel y no solo los de rol STAFF: en un bar chico el
 * dueño tambien atiende mesas, y si no aparece en la lista la mesa queda a
 * nombre de nadie.
 */
export async function getStaffMembers(): Promise<
  Array<{ id: string; name: string }>
> {
  return prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** Las zonas del salon, en el orden en que se ven en el mapa. */
export async function getZones(): Promise<ZoneSummary[]> {
  return prisma.posZone.findMany({
    where: { active: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, color: true },
  });
}

/** Estado de todas las mesas activas: lo primero que ve el garzon al entrar. */
export async function getTablesOverview(): Promise<TableOverview[]> {
  const tables = await prisma.posTable.findMany({
    where: { active: true },
    orderBy: [{ position: "asc" }, { number: "asc" }],
    include: {
      zone: { select: { id: true, name: true, color: true } },
      sessions: {
        where: { status: "OPEN" },
        orderBy: { openedAt: "desc" },
        take: 1,
        include: {
          attendedBy: { select: { id: true, name: true } },
          diners: { select: { id: true } },
          items: {
            where: { status: { not: "CANCELLED" } },
            select: {
              status: true,
              station: true,
              paymentId: true,
              unitPriceCents: true,
              discountCents: true,
              quantity: true,
            },
          },
          tickets: {
            where: { kind: "COMANDA", prep: "PENDIENTE" },
            select: { id: true },
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
            waiter: session.attendedBy
              ? { id: session.attendedBy.id, name: session.attendedBy.name }
              : null,
            tag: session.tag,
            tagColor: session.tagColor,
            draftItems: session.items.filter((item) => item.status === "DRAFT")
              .length,
            draftStations: [
              ...new Set(
                session.items
                  .filter((item) => item.status === "DRAFT")
                  .map((item) => item.station),
              ),
            ],
            pendingTickets: session.tickets.length,
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
  /** Linea regalada por una cortesia de BarzuCard. */
  courtesy: boolean;
};

/** Un beneficio de BarzuCard ya aplicado a la cuenta. */
export type AppliedPromotion = {
  redemptionId: string;
  promotionId: string;
  title: string;
  /** null = aplica a la cuenta compartida de la mesa. */
  dinerId: string | null;
  /** Lo que descuenta ahora mismo, recalculado sobre las lineas vivas. */
  discountCents: number;
  detail: string;
  /** Sigue aplicada pero hoy no descuenta: falta el producto en la cuenta. */
  missing: boolean;
  receiptCode: string;
};

export type AccountTab = {
  /** null = la cuenta compartida de la mesa. */
  dinerId: string | null;
  label: string;
  color: string | null;
  items: AccountItem[];
  /** Beneficios de BarzuCard aplicados a esta pestaña. */
  promotions: AppliedPromotion[];
  /** Suma de los beneficios de BarzuCard de esta pestaña. */
  promotionDiscountCents: number;
  /** Lo que falta cobrar, ya con los beneficios descontados. */
  pendingCents: number;
  paidCents: number;
};

/** La BarzuCard presentada en la mesa, tal como la ve la garzona. */
export type SessionCard = {
  id: string;
  cardNumber: string;
  memberName: string;
  status: string;
};

export type SessionDetail = {
  id: string;
  code: string;
  status: "OPEN" | "CLOSED";
  guests: number;
  note: string | null;
  openedAt: string;
  table: {
    id: string;
    number: number;
    name: string | null;
    zone: ZoneSummary | null;
  };
  /** Quien atiende la mesa ahora; arranca siendo quien la abrio. */
  waiter: { id: string; name: string } | null;
  tag: string | null;
  tagColor: string | null;
  /** Sin tarjeta no hay beneficios: es la condicion de todo el programa. */
  card: SessionCard | null;
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
    kind: TicketKind;
    /** Vacia en las de cobro: no van a ninguna estacion. */
    station: Station | null;
    status: string;
    /** Sigue en la estacion esperando que alguien la retire. */
    pendiente: boolean;
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
      table: {
        select: {
          id: true,
          number: true,
          name: true,
          zone: { select: { id: true, name: true, color: true } },
        },
      },
      attendedBy: { select: { id: true, name: true } },
      diners: { orderBy: { position: "asc" } },
      items: {
        orderBy: { createdAt: "asc" },
        // La categoria del producto la pide el motor de promociones: un "20%
        // en cervezas" necesita saber de que categoria es cada linea.
        include: { product: { select: { categoryId: true } } },
      },
      card: {
        include: { member: { select: { fullName: true, birthDate: true } } },
      },
      redemptions: {
        where: { voidedAt: null },
        orderBy: { redeemedAt: "asc" },
        include: { promotion: true },
      },
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
    courtesy: item.courtesy,
  });

  const vivos = session.items.filter((item) => item.status !== "CANCELLED");

  const buildTab = (
    dinerId: string | null,
    label: string,
    color: string | null,
  ): AccountTab => {
    const propias = vivos.filter((item) => item.dinerId === dinerId);
    const items = propias.map(toAccountItem);

    const consumoPendiente = items
      .filter((item) => !item.paid)
      .reduce((total, item) => total + item.totalCents, 0);

    /*
     * Los beneficios se recalculan sobre lo que hay AHORA sin cobrar.
     *
     * Guardarlos como un monto fijo al aplicarlos era la via corta y mentia:
     * si despues se anula el producto del 2x1, la cuenta seguia descontando
     * plata por algo que nadie consumio. Aca el descuento nace de las lineas,
     * asi que no puede quedar desfasado.
     */
    const lineas = promoLines(propias.filter((item) => item.paymentId === null));

    let acumulado = 0;
    const promotions: AppliedPromotion[] = session.redemptions
      .filter((redemption) => (redemption.dinerId ?? null) === dinerId)
      .map((redemption) => {
        const resolved = resolvePromotion(redemption.promotion, lineas);

        // Ninguna combinacion de beneficios puede dejar la cuenta en negativo.
        const disponible = Math.max(0, consumoPendiente - acumulado);
        const discountCents = Math.min(resolved.discountCents, disponible);
        acumulado += discountCents;

        return {
          redemptionId: redemption.id,
          promotionId: redemption.promotionId,
          title: redemption.promotion.title,
          dinerId: redemption.dinerId,
          discountCents,
          detail: resolved.detail,
          missing: resolved.missing,
          receiptCode: redemption.receiptCode,
        };
      });

    return {
      dinerId,
      label,
      color,
      items,
      promotions,
      promotionDiscountCents: acumulado,
      pendingCents: Math.max(0, consumoPendiente - acumulado),
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
    waiter: session.attendedBy
      ? { id: session.attendedBy.id, name: session.attendedBy.name }
      : null,
    tag: session.tag,
    tagColor: session.tagColor,
    card: session.card
      ? {
          id: session.card.id,
          cardNumber: session.card.cardNumber,
          memberName: session.card.member.fullName,
          status: session.card.status,
        }
      : null,
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
      kind: ticket.kind,
      // El resumen de cobro no tiene estacion: no lo prepara nadie.
      station: ticket.station,
      status: ticket.status,
      pendiente: ticket.kind === "COMANDA" && ticket.prep === "PENDIENTE",
      createdAt: ticket.createdAt.toISOString(),
      lastError: ticket.lastError,
    })),
  };
}

/** Traduce lineas de la cuenta a lo que entiende el motor de promociones. */
function promoLines(
  items: Array<{
    id: string;
    productId: string | null;
    product: { categoryId: string } | null;
    unitPriceCents: number;
    discountCents: number;
    quantity: number;
  }>,
): PromoLine[] {
  return items.map((item) => ({
    id: item.id,
    productId: item.productId,
    categoryId: item.product?.categoryId ?? null,
    unitPriceCents: item.unitPriceCents,
    discountCents: item.discountCents,
    quantity: item.quantity,
  }));
}

/** Una promocion tal como se le ofrece a la garzona en la mesa. */
export type PromotionOffer = {
  id: string;
  title: string;
  description: string;
  terms: string | null;
  typeLabel: string;
  scopeLabel: string;
  /** Producto o categoria sobre la que aplica, para nombrarlo en pantalla. */
  targetName: string | null;
  /** Lo que descontaria ahora mismo en esta cuenta. */
  previewCents: number;
  detail: string;
  /** Se puede aplicar. Si no, `reason` dice por que no. */
  available: boolean;
  reason: string | null;
  /** Ya esta aplicada en esta mesa. */
  applied: boolean;
  /**
   * Cortesia cuyo producto todavia no esta en la cuenta: al aplicarla, el POS
   * lo agrega solo y sale la comanda. No es un impedimento.
   */
  addsProduct: boolean;
};

const TYPE_SHORT: Record<string, string> = {
  PERCENT_OFF: "% off",
  AMOUNT_OFF: "Monto fijo",
  TWO_FOR_ONE: "2x1",
  FREE_ITEM: "Cortesía",
};

/**
 * Las promociones que esta mesa puede usar, ya resueltas contra su cuenta.
 *
 * Devuelve todas las vigentes —tambien las que hoy no aplican— con el motivo
 * escrito. Esconder las que no se pueden usar obliga a la garzona a explicar
 * de memoria por que el cliente no ve su promo; mostrarlas con el motivo
 * ("necesita 2 x Schop en la cuenta") convierte el problema en una venta.
 */
export async function getPromotionOffers(
  sessionId: string,
  dinerId: string | null,
  now = new Date(),
): Promise<PromotionOffer[]> {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    select: { id: true, cardId: true },
  });

  if (!session?.cardId) return [];

  const [card, promotions, items] = await Promise.all([
    prisma.barzuCard.findUnique({
      where: { id: session.cardId },
      // El socio viaja con la tarjeta: las promos de cumpleanos se habilitan
      // contra su fecha de nacimiento.
      select: {
        id: true,
        status: true,
        member: { select: { birthDate: true } },
      },
    }),
    prisma.promotion.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
      include: {
        product: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        sessionId,
        dinerId,
        status: { not: "CANCELLED" },
        paymentId: null,
      },
      select: {
        id: true,
        productId: true,
        product: { select: { categoryId: true } },
        unitPriceCents: true,
        discountCents: true,
        quantity: true,
      },
    }),
  ]);

  if (!card) return [];

  // Cuantas veces uso ya cada promocion esta tarjeta (los canjes anulados no
  // cuentan: la garzona se equivoco de boton y lo deshizo).
  const usos = await prisma.redemption.groupBy({
    by: ["promotionId"],
    where: { cardId: card.id, voidedAt: null },
    _count: { _all: true },
  });

  const usosPorPromo = new Map(
    usos.map((uso) => [uso.promotionId, uso._count._all]),
  );

  const aplicadas = new Set(
    (
      await prisma.redemption.findMany({
        where: { sessionId, voidedAt: null },
        select: { promotionId: true },
      })
    ).map((redemption) => redemption.promotionId),
  );

  const lineas = promoLines(items);

  return promotions.map((promotion) => {
    const eligibility = checkEligibility({
      promotion,
      card,
      redemptionsForThisPromotion: usosPorPromo.get(promotion.id) ?? 0,
      birthDate: card.member.birthDate,
      now,
    });

    const resolved = resolvePromotion(promotion, lineas);
    const applied = aplicadas.has(promotion.id);

    // La cortesia es el unico beneficio que no necesita nada cargado: al
    // aplicarla se agrega el producto a la cuenta y sale hacia la cocina.
    const addsProduct =
      promotion.type === "FREE_ITEM" &&
      promotion.scope === "PRODUCTO" &&
      resolved.missing;

    const faltaConsumo = resolved.missing && !addsProduct;

    return {
      id: promotion.id,
      title: promotion.title,
      description: promotion.description,
      terms: promotion.terms,
      typeLabel: TYPE_SHORT[promotion.type] ?? "Beneficio",
      scopeLabel:
        promotion.scope === "PRODUCTO"
          ? "Producto"
          : promotion.scope === "CATEGORIA"
            ? "Categoría"
            : "Toda la cuenta",
      targetName: promotion.product?.name ?? promotion.category?.name ?? null,
      previewCents: resolved.discountCents,
      detail: resolved.detail,
      available: eligibility.ok && !applied && !faltaConsumo,
      reason: applied
        ? "Ya aplicada en esta mesa"
        : !eligibility.ok
          ? eligibility.reason
          : faltaConsumo
            ? requirementLabel(
                promotion,
                promotion.product?.name,
                promotion.category?.name,
              )
            : null,
      applied,
      addsProduct,
    };
  });
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
