"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { deleteClosedDay, saveClosedDay } from "@/app/actions/admin/closures";
import { ActionButton } from "@/components/admin/action-button";
import { EmptyState, Panel } from "@/components/admin/ui";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { formatDateOnly } from "@/lib/format";
import { IDLE } from "@/lib/form-state";

export type ClosedDayRow = {
  id: string;
  date: string;
  /** El dia como "YYYY-MM-DD", para cruzarlo con los shows publicados. */
  day: string;
  reason: string;
  note: string | null;
};

/** Un show publicado que cae en un dia cerrado. */
export type ClosureConflict = { id: string; title: string; day: string };

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
        description="Ese día la cartelera dirá que el local no abre al público."
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
              hint="Es lo que verá el público en el calendario."
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

                  {/* Choque con la cartelera: hay un show publicado ese dia
                      que ya no se va a mostrar. Mejor enterarse aca. */}
                  {conflicts
                    .filter((conflict) => conflict.day === day.day)
                    .map((conflict) => (
                      <p
                        key={conflict.id}
                        className="mt-1 flex items-start gap-1.5 text-xs text-gilt-soft"
                      >
                        <AlertTriangle
                          className="mt-0.5 size-3.5 shrink-0"
                          aria-hidden
                        />
                        <span>
                          Ese día tienes publicado{" "}
                          <Link
                            href={`/admin/eventos/${conflict.id}`}
                            className="underline underline-offset-2"
                          >
                            {conflict.title}
                          </Link>
                          . Ya no se muestra en la cartelera; cámbialo de fecha
                          o quítalo de publicado.
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
