import type { PromotionScope, PromotionType } from "@/generated/prisma/enums";

/**
 * Cuanto descuenta una promocion sobre una cuenta.
 *
 * Este archivo es el corazon del programa y la pieza que faltaba. Antes una
 * promocion era un texto y un comprobante: el sistema decia "20% en cerveza",
 * imprimia un codigo y ahi terminaba su trabajo. Quien tenia que traducir eso
 * a plata era la garzona, con la calculadora del telefono y delante del
 * cliente. Aca la promocion se resuelve contra las lineas reales de la mesa y
 * devuelve un numero.
 *
 * No toca la base: recibe lineas y devuelve pesos. Lo usan el POS (para
 * mostrar el descuento en vivo), el cobro (para congelarlo) y el panel (para
 * previsualizar). Una sola cuenta, en un solo lugar.
 */

/** Una linea de la cuenta, con lo minimo que necesita el calculo. */
export type PromoLine = {
  id: string;
  productId: string | null;
  categoryId: string | null;
  /** Precio de lista, sin el descuento de carta. */
  unitPriceCents: number;
  /** Rebaja por unidad que ya trae la carta (happy hour, precio promo). */
  discountCents: number;
  quantity: number;
};

export type PromoRules = {
  type: PromotionType;
  scope: PromotionScope;
  /** % para PERCENT_OFF, centesimos para AMOUNT_OFF. */
  value: number;
  productId: string | null;
  categoryId: string | null;
};

export type PromoResult = {
  /** Lo que se le rebaja a la cuenta, en centesimos. */
  discountCents: number;
  /** Explicacion corta para la pantalla: "2 x Schop rubia · 1 gratis". */
  detail: string;
  /**
   * La promocion es valida pero hoy no descuenta nada, porque en la cuenta no
   * hay lo que pide. La pantalla lo muestra distinto de un descuento en cero:
   * no es un error, es "todavia no".
   */
  missing: boolean;
};

/** Lo que se paga por unidad, ya con el descuento de la carta. */
const netUnit = (line: PromoLine) =>
  Math.max(0, line.unitPriceCents - line.discountCents);

/** Las lineas sobre las que manda esta promocion. */
export function linesInScope(rules: PromoRules, lines: PromoLine[]) {
  switch (rules.scope) {
    case "PRODUCTO":
      return lines.filter((line) => line.productId === rules.productId);
    case "CATEGORIA":
      return lines.filter((line) => line.categoryId === rules.categoryId);
    default:
      return lines;
  }
}

/**
 * Precio unitario de cada unidad suelta, de la mas cara a la mas barata.
 *
 * Un 2x1 no se calcula sobre lineas sino sobre unidades: tres schops cargados
 * como "3 x Schop" son tres unidades y forman un par, no ninguno.
 */
function unitPrices(lines: PromoLine[]) {
  const units: number[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.quantity; i++) units.push(netUnit(line));
  }
  return units.sort((a, b) => b - a);
}

/**
 * Resuelve la promocion contra la cuenta.
 *
 * Reglas, en el orden en que las entiende quien atiende:
 *
 * - **% de descuento**: sobre lo que se consumio del alcance.
 * - **Monto fijo**: se rebaja del alcance, sin pasarse de lo consumido (no
 *   existe la cuenta negativa).
 * - **2x1**: por cada dos unidades del alcance, la mas barata del par sale
 *   gratis. Con tres unidades se regala una, no una y media.
 * - **Cortesia**: una unidad del producto sale gratis. Si el producto no esta
 *   en la cuenta, el POS lo agrega al aplicar la promo (asi la comanda igual
 *   sale hacia la cocina) y aca ya aparece como linea normal.
 */
export function resolvePromotion(
  rules: PromoRules,
  lines: PromoLine[],
): PromoResult {
  const scoped = linesInScope(rules, lines);
  const consumed = scoped.reduce(
    (total, line) => total + netUnit(line) * line.quantity,
    0,
  );

  if (scoped.length === 0 || consumed === 0) {
    return { discountCents: 0, detail: "", missing: true };
  }

  switch (rules.type) {
    case "PERCENT_OFF": {
      const percent = Math.min(100, Math.max(0, rules.value));
      const discount = Math.round((consumed * percent) / 100);
      return {
        discountCents: discount,
        detail: `${percent}% sobre ${formatScopeTotal(consumed)}`,
        missing: false,
      };
    }

    case "AMOUNT_OFF": {
      const discount = Math.min(rules.value, consumed);
      return {
        discountCents: discount,
        // Cuando la cuenta no llega al monto de la promo, el descuento se
        // recorta. Decirlo evita el reclamo de "me prometieron $3.000".
        detail:
          discount < rules.value
            ? `Tope: la cuenta suma ${formatScopeTotal(consumed)}`
            : "Descuento fijo",
        missing: false,
      };
    }

    case "TWO_FOR_ONE": {
      const units = unitPrices(scoped);
      const pairs = Math.floor(units.length / 2);

      if (pairs === 0) {
        return {
          discountCents: 0,
          detail: "Falta una unidad para el par",
          missing: true,
        };
      }

      // Ordenadas de mayor a menor, la barata de cada par es la impar.
      let discount = 0;
      for (let i = 0; i < pairs; i++) discount += units[i * 2 + 1]!;

      return {
        discountCents: discount,
        detail: `${pairs * 2} unidades · ${pairs} gratis`,
        missing: false,
      };
    }

    case "FREE_ITEM": {
      const units = unitPrices(scoped);
      const free = units.at(-1) ?? 0;

      return {
        discountCents: free,
        detail: "Una unidad de cortesía",
        missing: free === 0,
      };
    }

    default:
      return { discountCents: 0, detail: "", missing: true };
  }
}

/** Formato local, sin traer el helper de precios (que es de cliente). */
function formatScopeTotal(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString("es-CL")}`;
}

/**
 * Que necesita la cuenta para que la promocion sirva.
 *
 * Se le muestra a la garzona antes de aplicar: "agrega un Schop mas y el 2x1
 * empieza a descontar" es mucho mejor que un boton que no hace nada.
 */
export function requirementLabel(rules: PromoRules, productName?: string | null, categoryName?: string | null) {
  if (rules.scope === "PRODUCTO") {
    const name = productName ?? "ese producto";
    return rules.type === "TWO_FOR_ONE"
      ? `Necesita 2 x ${name} en la cuenta`
      : `Necesita ${name} en la cuenta`;
  }

  if (rules.scope === "CATEGORIA") {
    const name = categoryName ?? "esa categoría";
    return rules.type === "TWO_FOR_ONE"
      ? `Necesita 2 productos de ${name}`
      : `Necesita algo de ${name}`;
  }

  return "Necesita consumo en la cuenta";
}
