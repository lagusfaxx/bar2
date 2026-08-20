import "server-only";

import type { Station } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * Sondeo de cambios de las pantallas de sala.
 *
 * El problema que resuelve: la sala, la cuenta y los tableros de cocina y
 * barra se ponen al dia solos cada diez o quince segundos. Hasta ahora cada
 * vuelta rearmaba la pantalla entera en el servidor —la cuenta de una mesa son
 * mas de diez consultas y la carta completa viajando al telefono— aunque no
 * hubiera cambiado absolutamente nada. Con cinco aparatos abiertos toda la
 * noche eso es un pedido pesado cada dos segundos, sin que nadie toque nada:
 * es la razon de fondo por la que la app se arrastra y por la que el servidor
 * llega a quedarse sin aire (el "error 524" de Cloudflare, que aparece cuando
 * el origen tarda demasiado en contestar).
 *
 * Lo que hace en cambio: una sola consulta que devuelve una marca de estado
 * —la fecha del ultimo cambio y cuantas filas hay— y nada mas. Si la marca es
 * la misma que la de la pantalla, no hay nada que rehacer. La vista se rearma
 * solo cuando algo cambio de verdad, que es cuando importa.
 *
 * Todas las consultas de aca resuelven por indice y en una sola ida a la base:
 * son baratas a proposito, porque son las que corren todo el tiempo.
 */

export type PosScope =
  | { kind: "sala" }
  | { kind: "cuenta"; sessionId: string }
  | { kind: "estacion"; station: Station };

/**
 * Ventana de las cuentas de filas.
 *
 * Los maximos detectan altas y modificaciones, pero no bajas: si se borra una
 * linea, la fecha mas nueva sigue siendo la misma. Por eso ademas se cuenta.
 * Contar la tabla entera crece con el historico; contar solo lo tocado en las
 * ultimas horas no, y una baja de anteanoche no cambia ninguna pantalla viva.
 */
const VENTANA_HORAS = 12;

type Marca = Record<string, unknown>;

function desde() {
  const fecha = new Date();
  fecha.setHours(fecha.getHours() - VENTANA_HORAS);
  return fecha;
}

/** La marca en texto: es opaca, solo se compara con la anterior. */
function serializar(marca: Marca | undefined): string {
  if (!marca) return "0";

  return Object.values(marca)
    .map((valor) =>
      valor instanceof Date ? String(valor.getTime()) : String(valor ?? ""),
    )
    .join(".");
}

async function salaVersion() {
  const corte = desde();

  const [marca] = await prisma.$queryRaw<Marca[]>`
    SELECT
      (SELECT max("updatedAt") FROM "pos_table_sessions")                        AS "sesiones",
      (SELECT count(*)::int FROM "pos_table_sessions" WHERE "updatedAt" >= ${corte})  AS "sesionesN",
      (SELECT max("updatedAt") FROM "pos_order_items")                           AS "lineas",
      (SELECT count(*)::int FROM "pos_order_items" WHERE "updatedAt" >= ${corte})     AS "lineasN",
      (SELECT max("updatedAt") FROM "pos_order_tickets")                         AS "comandas",
      (SELECT count(*)::int FROM "pos_order_tickets" WHERE "updatedAt" >= ${corte})   AS "comandasN",
      (SELECT max("updatedAt") FROM "pos_tables")                                AS "mesas",
      (SELECT count(*)::int FROM "pos_tables" WHERE "active")                    AS "mesasN"
  `;

  return serializar(marca);
}

async function cuentaVersion(sessionId: string) {
  const [marca] = await prisma.$queryRaw<Marca[]>`
    SELECT
      (SELECT "updatedAt" FROM "pos_table_sessions" WHERE "id" = ${sessionId})                 AS "sesion",
      (SELECT max("updatedAt") FROM "pos_order_items" WHERE "sessionId" = ${sessionId})        AS "lineas",
      (SELECT count(*)::int FROM "pos_order_items" WHERE "sessionId" = ${sessionId})           AS "lineasN",
      (SELECT max("updatedAt") FROM "pos_order_tickets" WHERE "sessionId" = ${sessionId})      AS "comandas",
      (SELECT count(*)::int FROM "pos_order_tickets" WHERE "sessionId" = ${sessionId})         AS "comandasN",
      (SELECT max("updatedAt") FROM "pos_diners" WHERE "sessionId" = ${sessionId})             AS "comensales",
      (SELECT count(*)::int FROM "pos_diners" WHERE "sessionId" = ${sessionId})                AS "comensalesN",
      (SELECT max("paidAt") FROM "pos_payments" WHERE "sessionId" = ${sessionId})              AS "cobros",
      (SELECT count(*)::int FROM "pos_payments" WHERE "sessionId" = ${sessionId})              AS "cobrosN",
      (SELECT count(*)::int FROM "redemptions" WHERE "sessionId" = ${sessionId})               AS "beneficiosN",
      (SELECT count(*)::int FROM "redemptions"
        WHERE "sessionId" = ${sessionId} AND "voidedAt" IS NULL)                               AS "beneficiosVivosN"
  `;

  return serializar(marca);
}

async function estacionVersion(station: Station) {
  /*
   * Tambien se mira la fecha de las lineas, no solo la de la comanda: anular
   * un producto ya enviado cambia lo que la cocina tiene que preparar sin
   * tocar la comanda que lo contiene.
   */
  const [marca] = await prisma.$queryRaw<Marca[]>`
    SELECT
      (SELECT max("updatedAt") FROM "pos_order_tickets"
        WHERE "kind" = 'COMANDA' AND "station" = ${station}::"Station"
          AND "prep" = 'PENDIENTE')                                    AS "comandas",
      (SELECT count(*)::int FROM "pos_order_tickets"
        WHERE "kind" = 'COMANDA' AND "station" = ${station}::"Station"
          AND "prep" = 'PENDIENTE')                                    AS "comandasN",
      (SELECT max("i"."updatedAt") FROM "pos_order_items" AS "i"
        JOIN "pos_order_tickets" AS "t" ON "t"."id" = "i"."ticketId"
        WHERE "t"."kind" = 'COMANDA' AND "t"."station" = ${station}::"Station"
          AND "t"."prep" = 'PENDIENTE')                                AS "lineas"
  `;

  return serializar(marca);
}

/** Marca de estado de una pantalla. Cambia solo si cambio lo que muestra. */
export async function posVersion(scope: PosScope): Promise<string> {
  switch (scope.kind) {
    case "sala":
      return salaVersion();
    case "cuenta":
      return cuentaVersion(scope.sessionId);
    case "estacion":
      return estacionVersion(scope.station);
  }
}
