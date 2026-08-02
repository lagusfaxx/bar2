"use client";

import { Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { deleteUser, saveUser } from "@/app/actions/admin/content";
import { ActionButton } from "@/components/admin/action-button";
import { Panel, Table, TableWrap, Td, Th } from "@/components/admin/ui";
import {
  CheckboxField,
  Field,
  FormMessage,
  SelectField,
  SubmitButton,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/section";
import { formatDateTime } from "@/lib/format";
import { IDLE, type FormState } from "@/lib/form-state";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  EDITOR: "Editor",
  STAFF: "Equipo de sala",
};

const ROLE_HINTS: Record<string, string> = {
  ADMIN: "Acceso total, incluida la gestión de usuarios.",
  EDITOR: "Gestiona contenido, no gestiona usuarios.",
  STAFF: "Solo la app de verificación de BarzuCard.",
};

export function UsersManager({
  users,
  currentUserId,
}: {
  users: User[];
  currentUserId: string;
}) {
  const [state, setState] = useState<FormState>(IDLE);
  const [editing, setEditing] = useState<User | null>(null);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * Se llama a la Server Action desde la transición en lugar de usar
   * `useActionState`: así el resultado se conoce en el mismo callback y se puede
   * salir del modo edición sin recurrir a un efecto.
   */
  const action = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveUser(IDLE, formData);
      setState(result);

      if (result.status === "success") {
        formRef.current?.reset();
        setEditing(null);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Panel title={`${users.length} usuarios`}>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th>Rol</Th>
                <Th className="hidden md:table-cell">Último ingreso</Th>
                <Th>Estado</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <Td>
                    <span className="block text-sm text-bone">{user.name}</span>
                    <span className="block text-xs text-muted">{user.email}</span>
                  </Td>

                  <Td>
                    <Badge tone={user.role === "ADMIN" ? "crimson" : "muted"}>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </Badge>
                  </Td>

                  <Td className="hidden text-xs text-muted md:table-cell">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Nunca"}
                  </Td>

                  <Td>
                    <Badge tone={user.active ? "free" : "muted"}>
                      {user.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </Td>

                  <Td>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(user);
                          formRef.current?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="border border-line px-3 py-2 text-[0.62rem] tracking-[0.14em] text-muted uppercase transition-colors hover:border-crimson hover:text-bone"
                      >
                        Editar
                      </button>

                      {user.id !== currentUserId && (
                        <ActionButton
                          variant="danger"
                          confirm={`¿Eliminar la cuenta de ${user.name}?`}
                          action={async () => {
                            await deleteUser(user.id);
                          }}
                          title="Eliminar"
                          aria-label={`Eliminar ${user.name}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </ActionButton>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Panel>

      <Panel
        title={editing ? `Editar ${editing.name}` : "Nuevo usuario"}
        description={
          editing
            ? "Dejá la contraseña vacía para conservar la actual."
            : "Creá una cuenta para el equipo."
        }
        action={
          editing && (
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-xs text-muted transition-colors hover:text-bone"
            >
              Cancelar edición
            </button>
          )
        }
      >
        <form
          ref={formRef}
          action={action}
          key={editing?.id ?? "new"}
          className="flex flex-col gap-5"
        >
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Nombre"
              name="name"
              required
              defaultValue={editing?.name}
              maxLength={120}
              error={state.errors?.name}
            />
            <Field
              label="Email"
              name="email"
              type="email"
              required
              defaultValue={editing?.email}
              error={state.errors?.email}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Contraseña"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder={editing ? "Sin cambios" : "Mínimo 8 caracteres"}
              error={state.errors?.password}
            />

            <SelectField
              label="Rol"
              name="role"
              defaultValue={editing?.role ?? "EDITOR"}
              error={state.errors?.role}
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>

          <ul className="flex flex-col gap-1 text-xs text-muted-dark">
            {Object.entries(ROLE_HINTS).map(([role, hint]) => (
              <li key={role}>
                <span className="text-bone-dim">{ROLE_LABELS[role]}:</span> {hint}
              </li>
            ))}
          </ul>

          <CheckboxField
            label="Cuenta activa"
            name="active"
            defaultChecked={editing?.active ?? true}
          />

          <FormMessage state={state} />

          <SubmitButton className="self-start" pendingLabel="Guardando…">
            {editing ? "Guardar cambios" : "Crear usuario"}
          </SubmitButton>
        </form>
      </Panel>
    </div>
  );
}
