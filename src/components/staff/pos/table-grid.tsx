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
 *
 * Cada mesa dice "Libre" u "Ocupada" con todas las letras. El color ya lo
 * indicaba, pero un garzon nuevo no tiene por que saber que el rojo significa
 * ocupada —y quien no distingue bien los colores no lo sabe nunca—. La
 * palabra no le quita nada a la vista rapida y elimina la adivinanza.
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

                {/* "Sin mandar" no le dice nada a nadie: lo que hay que
                    entender es que la cocina todavia no vio esos productos. */}
                {ocupada && table.session!.draftItems > 0 && (
                  <span className="rounded-[2px] bg-gilt px-1.5 py-0.5 text-xs font-bold text-ink">
                    Falta enviar {table.session!.draftItems}
                  </span>
                )}
              </div>

              {ocupada ? (
                <div className="mt-2">
                  <p className="text-sm font-medium text-crimson-bright">
                    Ocupada
                  </p>
                  <p className="font-display text-lg text-bone">
                    {formatPrice(table.session!.pendingCents)}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                    <Users className="size-3.5" aria-hidden />
                    <span>
                      {table.session!.diners > 0
                        ? `Cuenta dividida en ${table.session!.diners}`
                        : `${table.session!.guests} personas`}
                    </span>
                    {/* El separador viaja pegado a lo que sigue: suelto,
                        cuando la tarjeta parte el renglon, queda un punto
                        colgando al final de la linea. */}
                    <span className="whitespace-nowrap">
                      <span aria-hidden>· </span>
                      hace <Elapsed since={table.session!.openedAt} />
                    </span>
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  <span className="mb-0.5 block text-sm font-medium text-bone-dim">
                    Libre
                  </span>
                  {table.name ?? table.zone ?? `${table.seats} lugares`}
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
        router.push(`/staff/pos/${result.data.sessionId}?nueva=1`);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] items-end bg-ink/80 backdrop-blur-sm">
      <div className="max-h-full w-full overflow-y-auto overscroll-contain border-t border-line bg-ink-soft p-5 pb-safe">
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
              "Abrir mesa"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
