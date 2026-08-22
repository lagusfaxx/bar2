"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { fieldErrors, posVoidPaymentSchema } from "@/lib/validation";

import { recordAudit } from "./audit";

/**
 * Deshacer plata cobrada.
 *
 * Solo el administrador, y solo desde el cierre de caja: es donde se descubre
 * el problema —al cuadrar el dia— y es la unica pantalla donde estan todos los
 * cobros juntos. El garzon no puede deshacer un cobro; si se equivoco, avisa.
 */

export async function voidPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = posVoidPaymentSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa la anulación.", fieldErrors(parsed.error));
  }

  const { paymentId, reason } = parsed.data;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      code: true,
      totalCents: true,
      voidedAt: true,
      session: { select: { id: true, kind: true, status: true } },
      items: { select: { id: true } },
    },
  });

  if (!payment) return formError("Ese cobro no existe.");

  // Anular dos veces no es un error del que haya que avisar: el segundo toque
  // suele ser la pantalla vieja de otro navegador.
  if (payment.voidedAt) return formSuccess("El cobro ya estaba anulado.");

  const { session } = payment;

  /*
   * Que pasa con lo que se habia cobrado.
   *
   * En una mesa o en una cuenta de pie, el consumo existio: alguien se lo tomo.
   * Vuelve a quedar pendiente para poder cobrarlo bien —otra forma de pago, la
   * mesa correcta— y por eso la cuenta se reabre si se habia cerrado con ese
   * cobro. Sin reabrirla, el garzon se quedaria con un consumo pendiente en una
   * cuenta que ya no puede tocar.
   *
   * En una venta directa no hay nada que volver a cobrar: la venta entera es
   * ese cobro. Sus lineas se anulan con el, y con eso desaparece tambien del
   * recuento de lo que mas se vende, que es lo que se espera de una prueba.
   */
  const esDirecta = session.kind === "DIRECTA";
  const itemIds = payment.items.map((item) => item.id);

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        voidedAt: new Date(),
        voidReason: reason,
        voidedById: admin.userId,
      },
    });

    if (itemIds.length > 0) {
      await tx.orderItem.updateMany({
        where: { id: { in: itemIds } },
        data: esDirecta
          ? { paymentId: null, status: "CANCELLED" }
          : { paymentId: null },
      });
    }

    /*
     * La comanda de una venta directa anulada no tiene que seguir esperando.
     *
     * Si la venta llevaba comida, la cocina tiene su papel en la pantalla
     * esperando que alguien lo retire. Anulada la venta no hay nada que
     * entregar, y sin esto ese pedido fantasma envejeceria ahi toda la noche
     * —igual que pasaba al cerrar una mesa (ver `closeTable`)—.
     */
    if (esDirecta) {
      await tx.orderTicket.updateMany({
        where: { sessionId: session.id, kind: "COMANDA", prep: "PENDIENTE" },
        data: { prep: "RETIRADA", pickedUpAt: new Date() },
      });
    }

    /*
     * Lo de la cuenta que sigue viva: beneficios y estado.
     *
     * Los beneficios de BarzuCard se congelan al cobrar con el monto que
     * descontaron (ver `payAccount`). Anulado el cobro, ese descuento no
     * ocurrio: vuelven a cero para que la cuenta los aplique de nuevo cuando se
     * cobre bien. Una venta directa no tiene ninguno —el mostrador no aplica
     * beneficios— ni cuenta que reabrir.
     */
    if (!esDirecta) {
      await tx.redemption.updateMany({
        where: { sessionId: session.id, voidedAt: null },
        data: { discountCents: 0 },
      });

      if (session.status === "CLOSED") {
        await tx.tableSession.update({
          where: { id: session.id },
          data: { status: "OPEN", closedAt: null },
        });
      }
    }
  });

  await recordAudit(
    admin.userId,
    "delete",
    "Payment",
    payment.id,
    `Cobro ${payment.code} anulado (${Math.round(payment.totalCents / 100).toLocaleString("es-CL")}): ${reason}`,
  );

  revalidatePath("/admin/caja");
  revalidatePath("/staff/cocina");
  revalidatePath("/admin");
  revalidatePath("/admin/en-vivo");
  revalidatePath("/staff/pos");
  revalidatePath(`/staff/pos/${session.id}`);

  return formSuccess(
    esDirecta
      ? `Venta ${payment.code} anulada.`
      : `Cobro ${payment.code} anulado. Lo consumido volvió a quedar pendiente en la cuenta.`,
  );
}
