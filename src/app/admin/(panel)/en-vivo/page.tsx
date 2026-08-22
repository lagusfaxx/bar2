import {
  AlertTriangle,
  Banknote,
  Clock,
  Info,
  Timer,
  Users,
  Utensils,
  Wine,
} from "lucide-react";
import Link from "next/link";

import { LiveRefresh } from "@/components/admin/live-refresh";
import {
  AdminHeader,
  EmptyState,
  Panel,
  StatCard,
} from "@/components/admin/ui";
import { getLiveService, type Alert, type LiveService } from "@/lib/dashboard";
import { formatPrice, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "El servicio en vivo" };

const METHOD_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  TRANSFERENCIA: "Transferencia",
  OTRO: "Otro",
};

/**
 * Como va la noche.
 *
 * Es la pantalla que mira quien administra el local mientras el local esta
 * abierto, no el informe del cierre: arriba lo que hay que ir a resolver ahora
 * —una comanda que lleva veinte minutos, una mesa a la que nadie le tomo el
 * pedido— y despues los numeros de la jornada.
 *
 * El cierre de caja, que es otra pregunta, sigue en /admin/caja.
 */
export default async function LivePage() {
  const live = await getLiveService();

  const desde = new Date(live.since);

  return (
    <>
      <AdminHeader
        title="El servicio en vivo"
        description={`La jornada que arrancó a las ${formatTime(desde)}. Se actualiza sola cada 30 segundos.`}
        action={<LiveRefresh />}
      />

      <Alerts alerts={live.alerts} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Vendido en la jornada"
          value={formatPrice(live.sales.totalCents)}
          hint={`${live.sales.payments} cobro(s) · promedio ${formatPrice(live.sales.averageTicketCents)}`}
          icon={<Banknote className="size-4" aria-hidden />}
        />
        <StatCard
          label="Sin cobrar en mesas"
          value={formatPrice(live.sales.openCents)}
          hint="Consumo cargado que todavía nadie pagó"
          tone="gilt"
          icon={<Clock className="size-4" aria-hidden />}
        />
        <StatCard
          label="Mesas ocupadas"
          value={`${live.room.open} / ${live.room.tables}`}
          hint={`${live.room.guests} personas sentadas · ${live.room.served} mesas en la jornada`}
          icon={<Users className="size-4" aria-hidden />}
        />
        <StatCard
          label="Demora de la cocina"
          value={
            live.kitchen.averageMinutes === null
              ? "—"
              : `${live.kitchen.averageMinutes} min`
          }
          hint={
            live.kitchen.averageMinutes === null
              ? "Todavía no se retiró ninguna comanda"
              : `Promedio de ${live.kitchen.served} comanda(s) · la peor, ${live.kitchen.worstMinutes} min`
          }
          tone={
            live.kitchen.averageMinutes !== null &&
            live.kitchen.averageMinutes >= 15
              ? "crimson"
              : "default"
          }
          icon={<Timer className="size-4" aria-hidden />}
        />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <HourlySales byHour={live.sales.byHour} />
        <Waiting pending={live.kitchen.pending} />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <Panel
          title="Lo más vendido de la jornada"
          description="Todo lo que salió de cocina y barra, esté cobrado o no."
        >
          {live.products.length === 0 ? (
            <EmptyState title="Todavía no se cargó ningún producto" />
          ) : (
            <ul className="flex flex-col gap-2">
              {live.products.map((product) => (
                <li
                  key={product.name}
                  className="flex items-baseline justify-between gap-4 border-b border-line pb-2 last:border-0"
                >
                  <span className="min-w-0 truncate text-bone">
                    <span className="font-display text-muted">
                      {product.quantity}×
                    </span>{" "}
                    {product.name}
                  </span>
                  <span className="shrink-0 text-bone-dim">
                    {formatPrice(product.cents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel
            title="Consumo por estación"
            description="Lo que salió de cada una, esté cobrado o no."
          >
            <div className="grid grid-cols-2 gap-4">
              <p>
                <span className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted">
                  <Wine className="size-4" aria-hidden />
                  Barra
                </span>
                <span className="mt-2 block font-display text-2xl text-bone">
                  {formatPrice(live.sales.byStation.BARRA)}
                </span>
              </p>
              <p>
                <span className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted">
                  <Utensils className="size-4" aria-hidden />
                  Cocina
                </span>
                <span className="mt-2 block font-display text-2xl text-bone">
                  {formatPrice(live.sales.byStation.COCINA)}
                </span>
              </p>
            </div>
          </Panel>

          <Panel title="Cómo están pagando">
            {live.sales.byMethod.length === 0 ? (
              <EmptyState title="Sin cobros todavía" />
            ) : (
              <ul className="flex flex-col gap-2">
                {live.sales.byMethod.map((method) => (
                  <li
                    key={method.method}
                    className="flex items-baseline justify-between gap-4 border-b border-line pb-2 last:border-0"
                  >
                    <span className="text-bone">
                      {METHOD_LABELS[method.method] ?? method.method}
                    </span>
                    <span className="text-right">
                      <span className="font-display text-lg text-bone">
                        {formatPrice(method.cents)}
                      </span>
                      <span className="ml-2 text-xs text-muted">
                        {method.count} cobro(s)
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {live.sales.byCashier.length > 0 && (
            <Panel title="Quién está cobrando">
              <ul className="flex flex-col gap-2">
                {live.sales.byCashier.map((cashier) => (
                  <li
                    key={cashier.name}
                    className="flex items-baseline justify-between gap-4 border-b border-line pb-2 last:border-0"
                  >
                    <span className="min-w-0 truncate text-bone">
                      {cashier.name}
                    </span>
                    <span className="text-right">
                      <span className="font-display text-lg text-bone">
                        {formatPrice(cashier.cents)}
                      </span>
                      <span className="ml-2 text-xs text-muted">
                        {cashier.count} cobro(s)
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Lo que hay que ir a resolver, arriba de todo.
 *
 * Cada aviso lleva escrito su nivel además del color: "urgente" en rojo y nada
 * mas no le sirve a quien no distingue los rojos, y este es justo el bloque que
 * no se puede perder de vista.
 */
function Alerts({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <Panel title="Todo al día">
        <p className="text-sm text-muted">
          Ninguna comanda demorada, ninguna mesa esperando. Cuando algo se
          atrase, aparece acá.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title={`Para mirar ahora · ${alerts.length}`}
      description="Ordenados por urgencia. Cada uno lleva al lugar donde se resuelve."
    >
      <ul className="flex flex-col gap-2">
        {alerts.map((alert) => {
          const grave = alert.level === "grave";

          const body = (
            <>
              <span
                className={[
                  "flex shrink-0 items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-[0.16em]",
                  grave ? "text-crimson-bright" : "text-gilt-soft",
                ].join(" ")}
              >
                {grave ? (
                  <AlertTriangle className="size-3.5" aria-hidden />
                ) : (
                  <Info className="size-3.5" aria-hidden />
                )}
                {grave ? "Urgente" : "Aviso"}
              </span>

              <span className="min-w-0">
                <span className="block text-bone">{alert.title}</span>
                <span className="block text-xs text-muted">{alert.detail}</span>
              </span>
            </>
          );

          const className = [
            "flex items-start gap-3 border px-4 py-3 transition-colors",
            grave
              ? "border-crimson/50 bg-crimson/10"
              : "border-gilt/40 bg-gilt/5",
          ].join(" ");

          return (
            <li key={alert.id}>
              {alert.href ? (
                <Link
                  href={alert.href}
                  className={`${className} hover:border-crimson`}
                >
                  {body}
                </Link>
              ) : (
                <div className={className}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/**
 * Lo cobrado hora por hora.
 *
 * Una sola serie, asi que no lleva leyenda: el titulo ya dice que es. Solo la
 * hora mas alta muestra su monto escrito —un numero sobre cada barra convierte
 * el grafico en una tabla mal hecha— y el resto se consulta pasando el mouse,
 * o leyendo la descripcion que acompana a cada barra con lector de pantalla.
 */
function HourlySales({ byHour }: { byHour: LiveService["sales"]["byHour"] }) {
  const max = Math.max(...byHour.map((slot) => slot.cents), 1);
  const total = byHour.reduce((sum, slot) => sum + slot.cents, 0);
  const peak = byHour.reduce((best, slot) => (slot.cents > best.cents ? slot : best));

  return (
    <Panel
      title="Ritmo de la noche"
      description="Lo cobrado en cada hora de la jornada."
    >
      {total === 0 ? (
        <EmptyState title="Sin cobros todavía" />
      ) : (
        <>
          <div className="flex h-48 items-end gap-[2px]" role="list">
            {byHour.map((slot) => {
              const alto = Math.round((slot.cents / max) * 100);
              const esPico = slot.cents === peak.cents && slot.cents > 0;

              return (
                <div
                  key={slot.hour}
                  role="listitem"
                  aria-label={`${slot.hour}:00, ${formatPrice(slot.cents)}`}
                  title={`${String(slot.hour).padStart(2, "0")}:00 · ${formatPrice(slot.cents)}`}
                  className="flex h-full flex-1 flex-col justify-end"
                >
                  {esPico && (
                    <span className="mb-1 block text-center text-[0.6rem] text-bone-dim">
                      {formatPrice(slot.cents)}
                    </span>
                  )}

                  <span
                    className={[
                      "block rounded-t-[4px] transition-[height]",
                      slot.cents === 0
                        ? "bg-line"
                        : esPico
                          ? "bg-crimson-bright"
                          : "bg-crimson",
                    ].join(" ")}
                    /* Las horas sin venta dejan una marca minima en vez de
                       desaparecer: un hueco vacio se lee como "no hubo esa
                       hora" en lugar de "esa hora no vendio". */
                    style={{ height: `${Math.max(alto, slot.cents === 0 ? 2 : 4)}%` }}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex gap-[2px]">
            {byHour.map((slot, index) => (
              <span
                key={slot.hour}
                className="flex-1 text-center text-[0.6rem] tabular-nums text-muted-dark"
              >
                {/* Con muchas horas, una de cada dos: si no, los numeros se
                    tocan y no se lee ninguno. */}
                {byHour.length <= 10 || index % 2 === 0 ? slot.hour : ""}
              </span>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

/** Comandas que siguen esperando, de la que mas lleva a la que menos. */
function Waiting({ pending }: { pending: LiveService["kitchen"]["pending"] }) {
  return (
    <Panel
      title={`Esperando en la estación · ${pending.length}`}
      description="Comandas mandadas que nadie retiró todavía."
    >
      {pending.length === 0 ? (
        <EmptyState title="No queda nada pendiente" />
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.map((ticket) => (
            <li
              key={ticket.id}
              className="flex items-baseline justify-between gap-4 border-b border-line pb-2 last:border-0"
            >
              <span className="min-w-0">
                <span className="block text-bone">
                  {ticket.title}
                  <span className="ml-2 text-xs text-muted">
                    #{ticket.number} ·{" "}
                    {ticket.station === "BARRA" ? "barra" : "cocina"}
                  </span>
                </span>
                <span className="block text-xs text-muted">
                  {ticket.items} producto(s)
                </span>
              </span>

              <span
                className={[
                  "shrink-0 font-display text-xl tabular-nums",
                  ticket.minutes >= 15
                    ? "text-crimson-bright"
                    : ticket.minutes >= 8
                      ? "text-gilt-soft"
                      : "text-bone-dim",
                ].join(" ")}
              >
                {ticket.minutes} min
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
