"use client";

import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { useActionState, useCallback, useEffect, useState } from "react";

import {
  createTableRange,
  deleteTable,
  deleteZone,
  moveZone,
  saveTable,
  saveZone,
} from "@/app/actions/admin/tables";
import { ActionButton } from "@/components/admin/action-button";
import { EmptyState, Panel, Table, TableWrap, Td, Th } from "@/components/admin/ui";
import { Field, FormMessage, SelectField, SubmitButton } from "@/components/ui/form";
import { IDLE } from "@/lib/form-state";
import { ZONE_COLORS, zoneColor, type ZoneColor } from "@/lib/pos-style";

export type ZoneRow = {
  id: string;
  name: string;
  color: string | null;
  active: boolean;
  /** Cuantas mesas hay en la zona: es lo que se pierde de vista si se borra. */
  tables: number;
};

export type TableRow = {
  id: string;
  number: number;
  name: string | null;
  zone: { id: string; name: string } | null;
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
export function TablesManager({
  zones,
  tables,
}: {
  zones: ZoneRow[];
  tables: TableRow[];
}) {
  const [editing, setEditing] = useState<TableRow | "new" | null>(null);

  // Estable entre renders: es dependencia del efecto que cierra el formulario.
  const close = useCallback(() => setEditing(null), []);

  return (
    <div className="flex flex-col gap-6">
      <ZonesPanel zones={zones} />

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
              zones={zones}
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
                    <Td>{table.zone?.name ?? "—"}</Td>
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
  zones,
  onSaved,
}: {
  table?: TableRow;
  zones: ZoneRow[];
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

        {/* La zona se elige de las que existen, no se escribe: escribiendola
            aparecian "Terraza" y "terraza" como dos secciones distintas del
            mapa y nadie entendia por que la mesa 8 estaba sola. */}
        <SelectField
          label="Zona"
          name="zoneId"
          defaultValue={table?.zone?.id ?? ""}
          error={state.errors?.zoneId}
          hint={
            zones.length === 0
              ? "Crea una zona arriba para agrupar las mesas del mapa."
              : "Agrupa la mesa en el mapa que ven los garzones."
          }
        >
          <option value="">Sin zona</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </SelectField>

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

/**
 * Zonas del salon.
 *
 * Son las secciones en las que se parte el mapa de sala: "Salón", "Terraza",
 * "Barra". Van arriba de las mesas porque es el orden en que se monta el
 * local: primero se dice que partes tiene, despues donde va cada mesa.
 */
function ZonesPanel({ zones }: { zones: ZoneRow[] }) {
  const [editing, setEditing] = useState<ZoneRow | "new" | null>(null);
  const close = useCallback(() => setEditing(null), []);

  return (
    <Panel
      title="Zonas"
      description="Las secciones del salón. En la app de los garzones, el mapa de mesas se agrupa por zona."
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
          {editing === "new" ? "Cancelar" : "Nueva zona"}
        </button>
      }
    >
      {editing && (
        <div className="mb-6">
          <ZoneForm
            zone={editing === "new" ? undefined : editing}
            onSaved={close}
          />
        </div>
      )}

      {zones.length === 0 ? (
        <EmptyState
          title="Todavía no hay zonas"
          description="Sin zonas, todas las mesas se ven juntas. Crea una por cada parte del local: salón, terraza, barra."
        />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Zona</Th>
                <Th>Mesas</Th>
                <Th>Estado</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone, index) => (
                <tr key={zone.id}>
                  <Td>
                    <span className="flex items-center gap-2">
                      <span
                        className={`size-2.5 rounded-full ${zoneColor(zone.color).dot}`}
                        aria-hidden
                      />
                      <span className="text-bone">{zone.name}</span>
                    </span>
                  </Td>
                  <Td>{zone.tables}</Td>
                  <Td>
                    {zone.active ? (
                      <span className="text-emerald-300">Visible</span>
                    ) : (
                      <span className="text-muted">Oculta</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      {/* El orden de las zonas es el orden en que se recorre
                          el local. Se sube y se baja aca porque el mapa de
                          sala se lee de arriba abajo igual que se camina. */}
                      {index > 0 && (
                        <ActionButton
                          aria-label={`Subir ${zone.name}`}
                          action={async () => {
                            await moveZone(zone.id, "up");
                          }}
                        >
                          <ChevronUp className="size-3.5" aria-hidden />
                        </ActionButton>
                      )}

                      {index < zones.length - 1 && (
                        <ActionButton
                          aria-label={`Bajar ${zone.name}`}
                          action={async () => {
                            await moveZone(zone.id, "down");
                          }}
                        >
                          <ChevronDown className="size-3.5" aria-hidden />
                        </ActionButton>
                      )}

                      <button
                        type="button"
                        onClick={() => setEditing(zone)}
                        className="border border-line px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.16em] text-muted hover:border-bone/40 hover:text-bone"
                      >
                        Editar
                      </button>

                      <ActionButton
                        variant="danger"
                        confirm={
                          zone.tables > 0
                            ? `¿Eliminar la zona "${zone.name}"? Sus ${zone.tables} mesa(s) quedan sin zona.`
                            : `¿Eliminar la zona "${zone.name}"?`
                        }
                        action={async () => {
                          await deleteZone(zone.id);
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
  );
}

function ZoneForm({ zone, onSaved }: { zone?: ZoneRow; onSaved: () => void }) {
  const [state, action] = useActionState(saveZone, IDLE);

  useEffect(() => {
    if (state.status === "success") onSaved();
  }, [state, onSaved]);

  return (
    <form action={action} className="border border-line bg-ink p-5">
      {zone && <input type="hidden" name="id" value={zone.id} />}

      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          label="Nombre"
          name="name"
          required
          defaultValue={zone?.name ?? ""}
          placeholder="Terraza"
          error={state.errors?.name}
        />

        {/* Color de lista y no libre: el mapa de sala se mira de reojo y con
            un color por zona alcanza para ubicarse. Uno elegido a mano en un
            apuro rompe el contraste sobre el fondo negro. */}
        <SelectField
          label="Color en el mapa"
          name="color"
          defaultValue={zone?.color ?? "bone"}
          error={state.errors?.color}
        >
          {(Object.keys(ZONE_COLORS) as ZoneColor[]).map((key) => (
            <option key={key} value={key}>
              {ZONE_COLORS[key].label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Estado"
          name="active"
          defaultValue={zone?.active === false ? "false" : "true"}
          hint="Una zona oculta no aparece en el mapa; sus mesas se ven sueltas."
        >
          <option value="true">Visible</option>
          <option value="false">Oculta</option>
        </SelectField>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5">
        <FormMessage state={state} />
        <SubmitButton className="self-start" pendingLabel="Guardando…">
          Guardar zona
        </SubmitButton>
      </div>
    </form>
  );
}
