"use client";

import { Info, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { deleteClosedDay, saveClosedDay } from "@/app/actions/admin/closures";
import { ActionButton } from "@/components/admin/action-button";
import { EmptyState, Panel } from "@/components/admin/ui";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { formatDateOnly } from "@/lib/format";
import { IDLE } from "@/lib/form-state";
import { cn } from "@/lib/utils";

export type ClosedDayRow = {
  id: string;
  date: string;
  /** El dia como "YYYY-MM-DD", para cruzarlo con los shows publicados. */
  day: string;
  reason: string;
  note: string | null;
};

/** Un show publicado que cae en un dia cerrado. */
export type ClosureConflict = {
  id: string;
  title: string;
  day: string;
  /** Marcado como abierto al publico: no hereda el cierre del dia. */
  open: boolean;
};

/**
 * Dias en que el local no abre.
 *
 * Es la excepcion de una fecha concreta —un evento privado, vacaciones—, no el
 * horario de una semana normal, que se edita en los datos del bar. Por eso vive
 * en su propia pantalla y se maneja con una lista corta: se agrega el dia, se
 * borra cuando ya paso o cuando el arriendo se cae.
 */
export function ClosuresManager({
  days,
  conflicts = [],
}: {
  days: ClosedDayRow[];
  conflicts?: ClosureConflict[];
}) {
  const [state, action] = useActionState(saveClosedDay, IDLE);

  // El calendario del navegador no deja elegir dias pasados: cerrar ayer no
  // sirve para nada y es un error facil de cometer con el teclado.
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title="Cerrar un día"
        description="Ese día la cartelera dirá que el local no abre al público. Si además publicas un show para esa fecha, el afiche se sigue viendo con la banda encima. ¿Ese show sí es para todos? Ábrelo en «¿Quién entra?» dentro del evento y el cierre no lo toca."
      >
        <form action={action} className="flex flex-col gap-5">
          <FormMessage state={state} />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="¿Qué día cierran?"
              name="date"
              type="date"
              min={hoy}
              required
              error={state.errors?.date}
            />

            <Field
              label="¿Por qué?"
              name="reason"
              defaultValue="Evento privado"
              placeholder="Evento privado"
              hint="Es lo que se lee en el calendario y cruzado sobre el afiche."
              error={state.errors?.reason}
            />
          </div>

          <Field
            label="Nota interna (opcional)"
            name="note"
            placeholder="Cumpleaños de los Pérez, 60 personas"
            hint="Solo la ven ustedes. No sale en la web."
            error={state.errors?.note}
          />

          <div>
            <SubmitButton pendingLabel="Guardando…">Marcar como cerrado</SubmitButton>
          </div>
        </form>
      </Panel>

      <Panel
        title="Días cerrados"
        description="Los próximos. Al borrar uno, ese día vuelve a aparecer como abierto."
      >
        {days.length === 0 ? (
          <EmptyState
            title="No hay días cerrados"
            description="Cuando arrienden el local para un evento privado, márcalo aquí y la cartelera lo avisará."
          />
        ) : (
          <ul className="flex flex-col">
            {days.map((day) => (
              <li
                key={day.id}
                className="flex items-center justify-between gap-4 border-b border-line/60 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm text-bone capitalize">
                    {formatDateOnly(day.date, { weekday: "long" })}
                  </p>
                  <p className="text-xs text-muted">
                    {day.reason}
                    {day.note && (
                      <span className="text-muted-dark"> · {day.note}</span>
                    )}
                  </p>

                  {/* El show de ese dia se sigue mostrando: privado si hereda
                      el cierre, abierto si se marco como publico. Se dice cual
                      de las dos cosas quedo, con el enlace para cambiarlo. */}
                  {conflicts
                    .filter((conflict) => conflict.day === day.day)
                    .map((conflict) => (
                      <p
                        key={conflict.id}
                        className={cn(
                          "mt-1 flex items-start gap-1.5 text-xs",
                          conflict.open ? "text-emerald-300" : "text-gilt-soft",
                        )}
                      >
                        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span>
                          <Link
                            href={`/admin/eventos/${conflict.id}`}
                            className="underline underline-offset-2"
                          >
                            {conflict.title}
                          </Link>{" "}
                          {conflict.open
                            ? "sigue anunciado como abierto al público esa noche."
                            : `se muestra ese día con la banda «${day.reason}» sobre el afiche. Si en realidad es para todos, ábrelo en «¿Quién entra?».`}
                        </span>
                      </p>
                    ))}
                </div>

                <ActionButton
                  action={async () => {
                    await deleteClosedDay(day.id);
                  }}
                  confirm={`¿Quitar el cierre del ${formatDateOnly(day.date)}? Ese día volverá a aparecer como abierto.`}
                  title="Volver a abrir ese día"
                  aria-label="Volver a abrir ese día"
                  variant="danger"
                >
                  <Trash2 className="size-4" aria-hidden />
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
