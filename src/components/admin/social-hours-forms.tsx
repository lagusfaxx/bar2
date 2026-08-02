"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import {
  deleteSocialLink,
  saveOpeningHours,
  saveSocialLink,
} from "@/app/actions/admin/content";
import { ActionButton } from "@/components/admin/action-button";
import { Panel } from "@/components/admin/ui";
import { SocialIcon, SOCIAL_PLATFORMS } from "@/components/site/social-icon";
import {
  CheckboxField,
  Field,
  FormMessage,
  SelectField,
  SubmitButton,
} from "@/components/ui/form";
import { WEEKDAY_LABELS } from "@/lib/format";
import { IDLE } from "@/lib/form-state";

type SocialLink = {
  id: string;
  platform: string;
  label: string;
  url: string;
  active: boolean;
};

export function SocialLinksManager({ links }: { links: SocialLink[] }) {
  const [state, action] = useActionState(saveSocialLink, IDLE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <Panel
      title="Redes sociales"
      description="Los enlaces se muestran en el pie de página, en contacto y en ubicación."
    >
      {links.length > 0 && (
        <ul className="mb-6 flex flex-col gap-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex items-center gap-3 border border-line bg-ink px-4 py-3"
            >
              <SocialIcon platform={link.platform} className="size-4 text-crimson" />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-bone">{link.label}</p>
                <p className="truncate text-xs text-muted">{link.url}</p>
              </div>

              {!link.active && (
                <span className="shrink-0 text-[0.6rem] tracking-[0.14em] text-muted-dark uppercase">
                  Oculto
                </span>
              )}

              <ActionButton
                variant="danger"
                confirm={`¿Eliminar el enlace a ${link.label}?`}
                action={async () => {
                  await deleteSocialLink(link.id);
                }}
                title="Eliminar"
                aria-label={`Eliminar ${link.label}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </ActionButton>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={action} className="flex flex-col gap-4 border-t border-line pt-5">
        <p className="text-[0.68rem] font-medium tracking-[0.18em] text-bone-dim uppercase">
          Agregar red social
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Red" name="platform" required error={state.errors?.platform}>
            {SOCIAL_PLATFORMS.map((platform) => (
              <option key={platform.value} value={platform.value}>
                {platform.label}
              </option>
            ))}
          </SelectField>

          <Field
            label="Nombre visible"
            name="label"
            required
            maxLength={60}
            placeholder="@barzuo.uy"
            error={state.errors?.label}
          />

          <Field
            label="Enlace"
            name="url"
            type="url"
            required
            placeholder="https://instagram.com/…"
            error={state.errors?.url}
          />
        </div>

        <CheckboxField label="Visible en el sitio" name="active" defaultChecked />

        <FormMessage state={state} />

        <SubmitButton size="sm" className="self-start" pendingLabel="Guardando…">
          Agregar enlace
        </SubmitButton>
      </form>
    </Panel>
  );
}

type OpeningHour = {
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  closed: boolean;
  note: string | null;
};

export function OpeningHoursManager({ hours }: { hours: OpeningHour[] }) {
  const [state, action] = useActionState(saveOpeningHours, IDLE);

  const byDay = new Map(hours.map((hour) => [hour.dayOfWeek, hour]));

  return (
    <Panel
      title="Horarios de atención"
      description="Se muestran en el pie de página, en Nosotros, en Contacto y en Ubicación."
    >
      <form action={action} className="flex flex-col gap-4">
        {WEEKDAY_LABELS.map((label, day) => {
          const hour = byDay.get(day);

          return (
            <div
              key={day}
              className="grid items-end gap-3 border-b border-line/60 pb-4 sm:grid-cols-[8rem_1fr_1fr_1fr_auto]"
            >
              <p className="text-sm text-bone-dim">{label}</p>

              <Field
                label="Abre"
                name={`opensAt-${day}`}
                type="time"
                defaultValue={hour?.opensAt ?? ""}
              />

              <Field
                label="Cierra"
                name={`closesAt-${day}`}
                type="time"
                defaultValue={hour?.closesAt ?? ""}
              />

              <Field
                label="Nota"
                name={`note-${day}`}
                maxLength={80}
                defaultValue={hour?.note ?? ""}
                placeholder="Karaoke"
              />

              <CheckboxField
                label="Cerrado"
                name={`closed-${day}`}
                defaultChecked={hour?.closed ?? false}
                className="pb-3"
              />
            </div>
          );
        })}

        <FormMessage state={state} />

        <SubmitButton size="sm" className="self-start" pendingLabel="Guardando…">
          Guardar horarios
        </SubmitButton>
      </form>
    </Panel>
  );
}
