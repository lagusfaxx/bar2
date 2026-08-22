import { Ban, Banknote, Receipt, Utensils, Wine } from "lucide-react";

import { PaymentVoid } from "@/components/admin/payment-void";
import {
  AdminHeader,
  EmptyState,
  Panel,
  StatCard,
  Table,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import { getPanelSession } from "@/lib/auth";
import { formatPrice, formatTime } from "@/lib/format";
import { lineTotal, sessionTitle } from "@/lib/pos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Caja" };

const METHOD_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  TRANSFERENCIA: "Transferencia",
  OTRO: "Otro",
};

/**
 * Cierre del dia.
 *
 * Responde lo que se pregunta al apagar las luces: cuanto se vendio, como
 * pagaron, cuanto se fue en promociones y que mesas quedaron abiertas.
 */
export default async function CashPage() {
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);

  const [session, todos, items, abiertas] = await Promise.all([
    getPanelSession(),
    prisma.payment.findMany({
      where: { paidAt: { gte: desde } },
      orderBy: { paidAt: "desc" },
      include: {
        session: {
          select: {
            kind: true,
            label: true,
            table: { select: { number: true, name: true } },
          },
        },
        diner: { select: { label: true } },
        cashier: { select: { name: true } },
        voidedBy: { select: { name: true } },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        status: { not: "CANCELLED" },
        // Lo cobrado y no anulado: un cobro anulado suelta sus lineas, asi que
        // esto ya las deja fuera, y el filtro lo dice en voz alta.
        payment: { paidAt: { gte: desde }, voidedAt: null },
      },
      select: {
        name: true,
        station: true,
        quantity: true,
        unitPriceCents: true,
        discountCents: true,
      },
    }),
    prisma.tableSession.findMany({
      where: { status: "OPEN" },
      orderBy: { openedAt: "asc" },
      include: {
        // `kind` y `label` vienen solos: en un `include` los campos propios
        // ya estan. Solo la mesa hay que pedirla, y puede no haber (cuenta de pie).
        table: { select: { number: true, name: true } },
        items: {
          where: { status: { not: "CANCELLED" }, paymentId: null },
          select: { unitPriceCents: true, discountCents: true, quantity: true },
        },
      },
    }),
  ]);

  /*
   * Lo anulado no es plata.
   *
   * Sale de todas las cifras del dia —total, formas de pago, mostrador, lo mas
   * vendido— y se lista aparte al final, que es donde tiene que estar: no se
   * borro nada, pero tampoco se cobro (ver `voidPayment`).
   */
  const payments = todos.filter((payment) => payment.voidedAt === null);
  const anulados = todos.filter((payment) => payment.voidedAt !== null);

  /** Deshacer plata cobrada es cosa del administrador, y solo desde aca. */
  const puedeAnular = session?.role === "ADMIN";

  const totalCents = payments.reduce((total, payment) => total + payment.totalCents, 0);
  const descuentoCents = payments.reduce(
    (total, payment) => total + payment.discountCents,
    0,
  );

  const porMetodo = new Map<string, { count: number; cents: number }>();

  for (const payment of payments) {
    const current = porMetodo.get(payment.method) ?? { count: 0, cents: 0 };
    porMetodo.set(payment.method, {
      count: current.count + 1,
      cents: current.cents + payment.totalCents,
    });
  }

  /* Lo que entro por el mostrador, aparte. Es la pregunta que no se podia
     responder antes de que existiera: cuanto de la noche se vendio sin mesa. */
  const directos = payments.filter((payment) => payment.session.kind === "DIRECTA");
  const directoCents = directos.reduce(
    (total, payment) => total + payment.totalCents,
    0,
  );

  const porEstacion = { BARRA: 0, COCINA: 0 };
  const porProducto = new Map<string, { quantity: number; cents: number }>();

  for (const item of items) {
    const cents = lineTotal(item);
    porEstacion[item.station] += cents;

    const current = porProducto.get(item.name) ?? { quantity: 0, cents: 0 };
    porProducto.set(item.name, {
      quantity: current.quantity + item.quantity,
      cents: current.cents + cents,
    });
  }

  const masVendidos = [...porProducto.entries()]
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 10);

  const pendienteCents = abiertas.reduce(
    (total, session) =>
      total + session.items.reduce((sum, item) => sum + lineTotal(item), 0),
    0,
  );

  return (
    <>
      <AdminHeader
        title="Ventas del día"
        description="Lo que se cobró hoy, desde la medianoche, y cómo pagó cada cliente."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Vendido hoy"
          value={formatPrice(totalCents)}
          hint={`${payments.length} cobro(s)`}
          icon={<Banknote className="size-4" aria-hidden />}
        />
        <StatCard
          label="Barra"
          value={formatPrice(porEstacion.BARRA)}
          icon={<Wine className="size-4" aria-hidden />}
        />
        <StatCard
          label="Cocina"
          value={formatPrice(porEstacion.COCINA)}
          icon={<Utensils className="size-4" aria-hidden />}
        />
        <StatCard
          label="Cobro directo"
          value={formatPrice(directoCents)}
          hint={`${directos.length} venta(s) de mostrador`}
          icon={<Receipt className="size-4" aria-hidden />}
        />
        <StatCard
          label="En promociones"
          value={formatPrice(descuentoCents)}
          hint="Lo que se resignó en precios promocionales"
          tone="gilt"
          icon={<Receipt className="size-4" aria-hidden />}
        />
      </div>

      {abiertas.length > 0 && (
        <Panel
          className="mt-6"
          title="Mesas abiertas"
          description={`${formatPrice(pendienteCents)} sin cobrar en este momento.`}
        >
          <ul className="flex flex-wrap gap-2">
            {abiertas.map((session) => (
              <li
                key={session.id}
                className="border border-line px-3 py-2 text-sm"
              >
                <span className="font-display text-bone">
                  {sessionTitle(session)}
                </span>
                <span className="ml-2 text-muted">
                  {formatPrice(
                    session.items.reduce((sum, item) => sum + lineTotal(item), 0),
                  )}
                </span>
                <span className="ml-2 text-xs text-muted-dark">
                  desde {formatTime(session.openedAt)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Formas de pago">
          {porMetodo.size === 0 ? (
            <EmptyState title="Todavía no se cobró nada hoy" />
          ) : (
            <ul className="flex flex-col gap-2">
              {[...porMetodo.entries()].map(([method, data]) => (
                <li
                  key={method}
                  className="flex items-baseline justify-between gap-4 border-b border-line pb-2 last:border-0"
                >
                  <span className="text-bone">{METHOD_LABELS[method] ?? method}</span>
                  <span className="text-right">
                    <span className="font-display text-lg text-bone">
                      {formatPrice(data.cents)}
                    </span>
                    <span className="ml-2 text-xs text-muted">
                      {data.count} cobro(s)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Más vendidos hoy">
          {masVendidos.length === 0 ? (
            <EmptyState title="Sin ventas todavía" />
          ) : (
            <ul className="flex flex-col gap-2">
              {masVendidos.map(([name, data]) => (
                <li
                  key={name}
                  className="flex items-baseline justify-between gap-4 border-b border-line pb-2 last:border-0"
                >
                  <span className="min-w-0 truncate text-bone">
                    <span className="text-muted">{data.quantity}×</span> {name}
                  </span>
                  <span className="shrink-0 text-bone-dim">
                    {formatPrice(data.cents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="mt-6" title="Cobros del día">
        {payments.length === 0 ? (
          <EmptyState title="Sin cobros" />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Hora</Th>
                  <Th>Comprobante</Th>
                  <Th>Origen</Th>
                  <Th>Cuenta</Th>
                  <Th>Forma</Th>
                  <Th>Cobró</Th>
                  <Th className="text-right">Total</Th>
                  {puedeAnular && <Th className="text-right">Anular</Th>}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <Td>{formatTime(payment.paidAt)}</Td>
                    <Td>
                      <span className="font-mono text-xs text-bone-dim">
                        {payment.code}
                      </span>
                    </Td>
                    <Td>{sessionTitle(payment.session)}</Td>
                    <Td>
                      {payment.diner?.label ??
                        (payment.session.table ? "Mesa completa" : "Cuenta completa")}
                    </Td>
                    <Td>{METHOD_LABELS[payment.method] ?? payment.method}</Td>
                    <Td>{payment.cashier?.name ?? "—"}</Td>
                    <Td className="text-right font-display text-bone">
                      {formatPrice(payment.totalCents)}
                    </Td>
                    {puedeAnular && (
                      <Td className="text-right">
                        <div className="flex justify-end">
                          <PaymentVoid
                            paymentId={payment.id}
                            code={payment.code}
                            total={formatPrice(payment.totalCents)}
                          />
                        </div>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>

      {anulados.length > 0 && (
        <Panel
          className="mt-6"
          title="Anulados hoy"
          description="No suman en ninguna cifra del día. Quedan aquí con el motivo y quién los anuló."
        >
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Hora</Th>
                  <Th>Comprobante</Th>
                  <Th>Origen</Th>
                  <Th>Motivo</Th>
                  <Th>Anuló</Th>
                  <Th className="text-right">Era</Th>
                </tr>
              </thead>
              <tbody>
                {anulados.map((payment) => (
                  <tr key={payment.id} className="text-muted">
                    <Td>{formatTime(payment.paidAt)}</Td>
                    <Td>
                      <span className="flex items-center gap-1.5 font-mono text-xs">
                        <Ban className="size-3.5 shrink-0 text-crimson" aria-hidden />
                        <span className="line-through">{payment.code}</span>
                      </span>
                    </Td>
                    <Td>{sessionTitle(payment.session)}</Td>
                    <Td>{payment.voidReason ?? "—"}</Td>
                    <Td>{payment.voidedBy?.name ?? "—"}</Td>
                    <Td className="text-right line-through">
                      {formatPrice(payment.totalCents)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Panel>
      )}
    </>
  );
}
