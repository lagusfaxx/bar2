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
import { formatPrice, PROMOTION_TYPE_LABELS, WEEKDAY_LABELS } from "@/lib/format";
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
  scope?: string;
  productId?: string | null;
  categoryId?: string | null;
  startsAt?: string;
  endsAt?: string;
  active?: boolean;
  maxPerCard?: number;
  maxTotal?: number;
  availableWeekdays?: number[];
  birthdayOnly?: boolean;
  birthdayWindowDays?: number;
};

/** La carta, para elegir sobre que aplica el beneficio. */
export type MenuTargets = {
  categories: Array<{ id: string; name: string }>;
  products: Array<{
    id: string;
    name: string;
    categoryId: string;
    categoryName: string;
    priceCents: number;
  }>;
};

export function PromotionForm({
  promotion,
  menu,
}: {
  promotion?: PromotionValues;
  menu: MenuTargets;
}) {
  const [state, action] = useActionState(savePromotion, IDLE);
  const [type, setType] = useState(promotion?.type ?? "PERCENT_OFF");
  const [scope, setScope] = useState(promotion?.scope ?? "CUENTA");

  const needsValue = type === "PERCENT_OFF" || type === "AMOUNT_OFF";

  /*
   * Una cortesia regala un producto y un 2x1 necesita algo que contar de a
   * pares: ninguno de los dos tiene sentido "sobre toda la cuenta". En vez de
   * dejar elegir y rechazar al guardar, el alcance se ajusta solo.
   */
  const scopeFijo = type === "FREE_ITEM";
  const scopeReal = scopeFijo ? "PRODUCTO" : scope;

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
                placeholder="2x1 en cervezas de barril"
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
                  onChange={(event) => {
                    setType(event.target.value);
                    if (event.target.value === "FREE_ITEM") setScope("PRODUCTO");
                    if (
                      event.target.value === "TWO_FOR_ONE" &&
                      scope === "CUENTA"
                    ) {
                      setScope("PRODUCTO");
                    }
                  }}
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

              {/*
                Sobre que aplica.

                Es el campo que convierte una promocion en algo que el POS
                puede cobrar. Sin el, "2x1 en cervezas" era una frase bonita
                que la garzona tenia que interpretar con la calculadora.
              */}
              <div className="border border-line bg-ink p-4">
                <SelectField
                  label="Se aplica sobre"
                  name="scope"
                  value={scopeReal}
                  disabled={scopeFijo}
                  onChange={(event) => setScope(event.target.value)}
                  error={state.errors?.scope}
                >
                  {!scopeFijo && type !== "TWO_FOR_ONE" && (
                    <option value="CUENTA">Toda la cuenta</option>
                  )}
                  <option value="CATEGORIA">Una categoría de la carta</option>
                  <option value="PRODUCTO">Un producto</option>
                </SelectField>

                {/* Un select deshabilitado no viaja en el formulario. */}
                {scopeFijo && (
                  <input type="hidden" name="scope" value="PRODUCTO" />
                )}

                {scopeReal === "CATEGORIA" && (
                  <div className="mt-5">
                    <SelectField
                      label="Categoría"
                      name="categoryId"
                      defaultValue={promotion?.categoryId ?? ""}
                      error={state.errors?.categoryId}
                    >
                      <option value="">Elige una categoría…</option>
                      {menu.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                )}

                {scopeReal === "PRODUCTO" && (
                  <div className="mt-5">
                    <SelectField
                      label="Producto"
                      name="productId"
                      defaultValue={promotion?.productId ?? ""}
                      error={state.errors?.productId}
                    >
                      <option value="">Elige un producto…</option>
                      {menu.products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.categoryName} · {product.name} ·{" "}
                          {formatPrice(product.priceCents)}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                )}

                <p className="mt-3 text-xs text-muted-dark">
                  {type === "FREE_ITEM"
                    ? "La cortesía se agrega sola a la cuenta cuando la garzona aplica el beneficio, y sale la comanda hacia la cocina o la barra."
                    : type === "TWO_FOR_ONE"
                      ? "Por cada dos unidades en la cuenta, la más barata del par sale gratis."
                      : "El POS descuenta esto solo, en la cuenta de la mesa, cuando el cliente presenta su BarzuCard."}
                </p>
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
            description="Lo que valida el sistema cuando la garzona aplica el beneficio en la mesa."
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
                  Si no marcas ninguno, la promoción vale todos los días.
                </p>
              </fieldset>

              {/* El cumpleaños no es un día de la semana más: no se puede
                  expresar con las casillas de arriba porque cambia para cada
                  socio. Por eso va aparte y con su propia ventana. */}
              <fieldset>
                <legend className="mb-3 text-[0.68rem] font-medium tracking-[0.18em] text-bone-dim uppercase">
                  Cumpleaños
                </legend>

                <CheckboxField
                  label="Solo para el cumpleaños del socio"
                  name="birthdayOnly"
                  defaultChecked={promotion?.birthdayOnly ?? false}
                  hint="Se habilita solo si el socio registró su fecha de nacimiento."
                />

                <div className="mt-4">
                  <Field
                    label="Días alrededor de la fecha"
                    name="birthdayWindowDays"
                    type="number"
                    min={0}
                    max={60}
                    defaultValue={promotion?.birthdayWindowDays ?? 7}
                    hint="7 significa una semana antes y una después. Nadie festeja necesariamente el mismo día: un cumpleaños de martes se celebra el viernes."
                    error={state.errors?.birthdayWindowDays}
                  />
                </div>
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
