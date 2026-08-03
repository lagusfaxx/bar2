"use client";

import { Plus, X } from "lucide-react";
import { useActionState, useCallback, useEffect, useState } from "react";

import {
  createTableRange,
  deleteTable,
  saveTable,
} from "@/app/actions/admin/tables";
import { ActionButton } from "@/components/admin/action-button";
import { EmptyState, Panel, Table, TableWrap, Td, Th } from "@/components/admin/ui";
import { Field, FormMessage, SelectField, SubmitButton } from "@/components/ui/form";
import { IDLE } from "@/lib/form-state";

export type TableRow = {
  id: string;
  number: number;
  name: string | null;
  zone: string | null;
  seats: number;
  active: boolean;
  openSessions: number;
};

/**
 * Mesas del salon.
 *
 * Son la puerta de entrada del POS: sin mesas cargadas, los garzones no tienen
 * donde abrir una cuenta.
 */
export function TablesManager({ tables }: { tables: TableRow[] }) {
  const [editing, setEditing] = useState<TableRow | "new" | null>(null);

  // Estable entre renders: es dependencia del efecto que cierra el formulario.
  const close = useCallback(() => setEditing(null), []);

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title="Mesas"
        description="El número es el que usan los garzones y el que sale impreso en la comanda."
        action={
          <button
            type="button"
            onClick={() => setEditing(editing === "new" ? null : "new")}
            className="flex items-center gap-2 border border-line px-3 py-2 text-[0.65rem] uppercase tracking-[0.16em] text-muted hover:border-crimson hover:text-crimson-bright"
          >
            {editing === "new" ? (
              <X className="size-3.5" aria-hidden />
            ) : (
              <Plus className="size-3.5" aria-hidden />
            )}
            {editing === "new" ? "Cancelar" : "Nueva mesa"}
          </button>
        }
      >
        {editing && (
          <div className="mb-6">
            <TableForm
              table={editing === "new" ? undefined : editing}
              onSaved={close}
            />
          </div>
        )}

        {tables.length === 0 ? (
          <EmptyState
            title="Todavía no hay mesas"
            description="Crea una por cada mesa del salón. Puedes agruparlas por zona (salón, terraza, barra)."
            action={<QuickRange />}
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Mesa</Th>
                  <Th>Zona</Th>
                  <Th>Lugares</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {tables.map((table) => (
                  <tr key={table.id}>
                    <Td>
                      <span className="font-display text-lg text-bone">
                        {table.number}
                      </span>
                      {table.name && (
                        <span className="ml-2 text-xs text-muted">
                          {table.name}
                        </span>
                      )}
                    </Td>
                    <Td>{table.zone ?? "—"}</Td>
                    <Td>{table.seats}</Td>
                    <Td>
                      {table.openSessions > 0 ? (
                        <span className="text-crimson-bright">Ocupada</span>
                      ) : table.active ? (
                        <span className="text-emerald-300">Libre</span>
                      ) : (
                        <span className="text-muted">Inactiva</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(table)}
                          className="border border-line px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.16em] text-muted hover:border-bone/40 hover:text-bone"
                        >
                          Editar
                        </button>

                        <ActionButton
                          variant="danger"
                          confirm={`¿Eliminar la mesa ${table.number}?`}
                          action={async () => {
                            await deleteTable(table.id);
                          }}
                        >
                          Eliminar
                        </ActionButton>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}

/** Atajo para montar el salon de una vez: "crear mesas hasta la 20". */
function QuickRange() {
  const [state, action] = useActionState(createTableRange, IDLE);

  return (
    <form action={action} className="flex flex-col items-center gap-3">
      <div className="flex items-end gap-3">
        <Field
          label="Crear mesas hasta la"
          name="upTo"
          inputMode="numeric"
          defaultValue="20"
          className="w-40"
          error={state.errors?.upTo}
        />
        <SubmitButton pendingLabel="Creando…">Crear</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

function TableForm({
  table,
  onSaved,
}: {
  table?: TableRow;
  onSaved: () => void;
}) {
  const [state, action] = useActionState(saveTable, IDLE);

  // Se cierra solo al guardar bien. Va en un efecto y no en el render: alli
  // el setState del padre volveria a entrar por aca en bucle.
  useEffect(() => {
    if (state.status === "success") onSaved();
  }, [state, onSaved]);

  return (
    <form action={action} className="border border-line bg-ink p-5">
      {table && <input type="hidden" name="id" value={table.id} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Número"
          name="number"
          required
          inputMode="numeric"
          defaultValue={table?.number?.toString()}
          error={state.errors?.number}
        />

        <Field
          label="Nombre (opcional)"
          name="name"
          defaultValue={table?.name ?? ""}
          placeholder="Terraza 2"
          error={state.errors?.name}
        />

        <Field
          label="Zona"
          name="zone"
          defaultValue={table?.zone ?? ""}
          placeholder="Salón, terraza, barra"
          error={state.errors?.zone}
        />

        <Field
          label="Lugares"
          name="seats"
          inputMode="numeric"
          defaultValue={(table?.seats ?? 4).toString()}
          error={state.errors?.seats}
        />

        <SelectField
          label="Estado"
          name="active"
          defaultValue={table?.active === false ? "false" : "true"}
          hint="Una mesa inactiva no aparece en la app de los garzones."
        >
          <option value="true">Activa</option>
          <option value="false">Inactiva</option>
        </SelectField>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5">
        <FormMessage state={state} />
        <SubmitButton className="self-start" pendingLabel="Guardando…">
          Guardar mesa
        </SubmitButton>
      </div>
    </form>
  );
}
