"use client";

import { useActionState, useState } from "react";

import { savePromotion } from "@/app/actions/admin/content";
import { ImageField } from "@/components/admin/image-field";
import { Panel } from "@/components/admin/ui";
import {
  CheckboxField,
  Field,
  FormMessage,
  SelectField,
  SubmitButton,
  TextareaField,
} from "@/components/ui/form";
import { PROMOTION_TYPE_LABELS, TIER_LABELS, WEEKDAY_LABELS } from "@/lib/format";
import { IDLE } from "@/lib/form-state";

export type PromotionValues = {
  id?: string;
  slug?: string;
  title?: string;
  description?: string;
  terms?: string | null;
  imageUrl?: string | null;
  type?: string;
  value?: string;
  startsAt?: string;
  endsAt?: string;
  active?: boolean;
  minTier?: string;
  maxPerCard?: number;
  maxTotal?: number;
  pointsCost?: number;
  pointsReward?: number;
  availableWeekdays?: number[];
};

export function PromotionForm({ promotion }: { promotion?: PromotionValues }) {
  const [state, action] = useActionState(savePromotion, IDLE);
  const [type, setType] = useState(promotion?.type ?? "PERCENT_OFF");

  const needsValue = type === "PERCENT_OFF" || type === "AMOUNT_OFF";

  return (
    <form action={action} className="flex flex-col gap-6">
      {promotion?.id && <input type="hidden" name="id" value={promotion.id} />}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-6">
          <Panel title="El beneficio">
            <div className="flex flex-col gap-5">
              <Field
                label="Título"
                name="title"
                required
                defaultValue={promotion?.title}
                maxLength={140}
                placeholder="2x1 en chopps"
                error={state.errors?.title}
              />

              <TextareaField
                label="Descripción"
                name="description"
                required
                rows={3}
                maxLength={600}
                defaultValue={promotion?.description}
                placeholder="Qué se lleva el socio al canjear."
                error={state.errors?.description}
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <SelectField
                  label="Tipo de beneficio"
                  name="type"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  error={state.errors?.type}
                >
                  {Object.entries(PROMOTION_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>

                {needsValue && (
                  <Field
                    label={
                      type === "PERCENT_OFF"
                        ? "Porcentaje de descuento"
                        : "Monto del descuento"
                    }
                    name="value"
                    inputMode="decimal"
                    defaultValue={promotion?.value}
                    placeholder={type === "PERCENT_OFF" ? "20" : "200"}
                    hint={
                      type === "PERCENT_OFF"
                        ? "Sin el símbolo %."
                        : "En pesos."
                    }
                    error={state.errors?.value}
                  />
                )}
              </div>

              <TextareaField
                label="Términos y condiciones"
                name="terms"
                rows={4}
                maxLength={1200}
                defaultValue={promotion?.terms ?? ""}
                placeholder="Vigencia, días habilitados, restricciones."
                error={state.errors?.terms}
              />

              <ImageField
                label="Imagen"
                name="imageUrl"
                preset="cover"
                aspect="aspect-3/2"
                defaultValue={promotion?.imageUrl}
              />
            </div>
          </Panel>

          <Panel
            title="Reglas de canje"
            description="Determinan qué valida el sistema cuando el garzón escanea una BarzuCard."
          >
            <div className="flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Usos por tarjeta"
                  name="maxPerCard"
                  type="number"
                  min={0}
                  defaultValue={promotion?.maxPerCard ?? 1}
                  hint="0 = sin límite de usos."
                  error={state.errors?.maxPerCard}
                />
                <Field
                  label="Cupo total"
                  name="maxTotal"
                  type="number"
                  min={0}
                  defaultValue={promotion?.maxTotal ?? 0}
                  hint="0 = sin tope global."
                  error={state.errors?.maxTotal}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <SelectField
                  label="Nivel mínimo"
                  name="minTier"
                  defaultValue={promotion?.minTier ?? "CLASICA"}
                  error={state.errors?.minTier}
                >
                  {Object.entries(TIER_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>

                <Field
                  label="Cuesta (puntos)"
                  name="pointsCost"
                  type="number"
                  min={0}
                  defaultValue={promotion?.pointsCost ?? 0}
                  hint="0 = gratuito."
                  error={state.errors?.pointsCost}
                />

                <Field
                  label="Otorga (puntos)"
                  name="pointsReward"
                  type="number"
                  min={0}
                  defaultValue={promotion?.pointsReward ?? 0}
                  error={state.errors?.pointsReward}
                />
              </div>

              <fieldset>
                <legend className="mb-3 text-[0.68rem] font-medium tracking-[0.18em] text-bone-dim uppercase">
                  Días habilitados
                </legend>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_LABELS.map((label, day) => (
                    <label
                      key={day}
                      className="flex cursor-pointer items-center gap-2 border border-line px-3 py-2 text-xs text-muted transition-colors hover:border-bone/30 hover:text-bone has-checked:border-crimson has-checked:text-bone"
                    >
                      <input
                        type="checkbox"
                        name="availableWeekdays"
                        value={day}
                        defaultChecked={promotion?.availableWeekdays?.includes(day)}
                        className="size-3.5 accent-crimson"
                      />
                      {label.slice(0, 3)}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-dark">
                  Si no marcás ninguno, la promoción vale todos los días.
                </p>
              </fieldset>
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Vigencia y estado">
            <div className="flex flex-col gap-5">
              <Field
                label="Desde"
                name="startsAt"
                type="date"
                required
                defaultValue={promotion?.startsAt}
                error={state.errors?.startsAt}
              />
              <Field
                label="Hasta"
                name="endsAt"
                type="date"
                defaultValue={promotion?.endsAt}
                hint="Dejalo vacío para que no venza."
                error={state.errors?.endsAt}
              />

              <CheckboxField
                label="Promoción activa"
                name="active"
                defaultChecked={promotion?.active ?? true}
              />

              <Field
                label="Enlace amigable (slug)"
                name="slug"
                defaultValue={promotion?.slug ?? ""}
                maxLength={90}
                placeholder="Se genera solo"
                error={state.errors?.slug}
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5">
              <FormMessage state={state} />
              <SubmitButton className="w-full" pendingLabel="Guardando…">
                Guardar promoción
              </SubmitButton>
            </div>
          </Panel>
        </div>
      </div>
    </form>
  );
}
