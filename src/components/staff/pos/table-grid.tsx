"use client";

import { Loader2, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { openTable } from "@/app/actions/pos";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { IDLE, type FormState } from "@/lib/form-state";
import type { TableOverview } from "@/lib/pos";

/**
 * Estado de la sala.
 *
 * Una mesa libre se abre en dos toques (mesa y cuantos son); una ocupada
 * lleva directo a su cuenta. Todo con el pulgar, que es como se usa esto
 * mientras se camina entre mesas.
 */
export function TableGrid({ tables }: { tables: TableOverview[] }) {
  const router = useRouter();
  const [opening, setOpening] = useState<TableOverview | null>(null);

  if (tables.length === 0) {
    return (
      <p className="border border-line bg-ink-soft p-6 text-sm text-muted">
        No hay mesas cargadas. Créalas en el panel, en <strong>Sala → Mesas</strong>.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tables.map((table) => {
          const ocupada = table.session !== null;

          return (
            <button
              key={table.id}
              type="button"
              onClick={() =>
                ocupada
                  ? router.push(`/staff/pos/${table.session!.id}`)
                  : setOpening(table)
              }
              className={[
                "flex min-h-28 flex-col justify-between border p-3 text-left transition-colors",
                ocupada
                  ? "border-crimson/50 bg-crimson/10 hover:border-crimson"
                  : "border-line bg-ink-soft hover:border-bone/40",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-2xl text-bone">
                  {table.number}
                </span>

                {ocupada && table.session!.draftItems > 0 && (
                  <span
                    className="rounded-[2px] bg-gilt px-1.5 py-0.5 text-[0.6rem] font-bold text-ink"
                    title="Productos cargados sin mandar a comanda"
                  >
                    {table.session!.draftItems} sin mandar
                  </span>
                )}
              </div>

              {ocupada ? (
                <div className="mt-2">
                  <p className="font-display text-lg text-bone">
                    {formatPrice(table.session!.pendingCents)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[0.65rem] uppercase tracking-[0.16em] text-muted">
                    <Users className="size-3" aria-hidden />
                    {table.session!.diners > 0
                      ? `${table.session!.diners} cuenta(s)`
                      : `${table.session!.guests} pers.`}
                    <span aria-hidden>·</span>
                    <Elapsed since={table.session!.openedAt} />
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-[0.65rem] uppercase tracking-[0.16em] text-muted">
                  {table.name ?? table.zone ?? `${table.seats} lugares`}
                  <span className="mt-1 block text-bone-dim">Libre</span>
                </p>
              )}
            </button>
          );
        })}
      </div>

      {opening && (
        <OpenTableSheet table={opening} onClose={() => setOpening(null)} />
      )}
    </>
  );
}

/**
 * Hace cuanto se abrio la mesa.
 *
 * Se calcula despues de montar y se refresca cada minuto: leer el reloj en el
 * render daria un valor distinto en el servidor y en el cliente.
 */
function Elapsed({ since }: { since: string }) {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const update = () =>
      setMinutes(Math.max(0, Math.round((Date.now() - Date.parse(since)) / 60000)));

    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [since]);

  if (minutes === null) return null;
  if (minutes < 60) return <>{minutes} min</>;

  return (
    <>
      {Math.floor(minutes / 60)} h {minutes % 60} min
    </>
  );
}

function OpenTableSheet({
  table,
  onClose,
}: {
  table: TableOverview;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();
  const [guests, setGuests] = useState(2);

  const submit = () => {
    const formData = new FormData();
    formData.set("tableId", table.id);
    formData.set("guests", String(guests));

    startTransition(async () => {
      const result = await openTable(IDLE, formData);
      setState(result);

      if (result.status === "success" && result.data?.sessionId) {
        router.push(`/staff/pos/${result.data.sessionId}`);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/80 backdrop-blur-sm">
      <div className="w-full border-t border-line bg-ink-soft p-5">
        <h2 className="font-display text-xl text-bone">
          Abrir mesa {table.number}
        </h2>
        <p className="mt-1 text-xs text-muted">¿Cuántas personas se sentaron?</p>

        <div className="mt-5 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => setGuests((value) => Math.max(1, value - 1))}
            className="flex size-14 items-center justify-center border border-line text-2xl text-bone"
            aria-label="Menos personas"
          >
            −
          </button>

          <span className="font-display text-5xl text-bone" aria-live="polite">
            {guests}
          </span>

          <button
            type="button"
            onClick={() => setGuests((value) => Math.min(40, value + 1))}
            className="flex size-14 items-center justify-center border border-line text-2xl text-bone"
            aria-label="Más personas"
          >
            <Plus className="size-5" aria-hidden />
          </button>
        </div>

        {state.status === "error" && (
          <p role="alert" className="mt-4 text-sm text-crimson-bright">
            {state.message}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>

          <Button className="flex-1" onClick={submit} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              "Abrir"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
