"use client";

import { useActionState } from "react";

import { saveMenuCategory, saveMenuProduct } from "@/app/actions/admin/menu";
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
import { IDLE } from "@/lib/form-state";

export type CategoryValues = {
  id?: string;
  slug?: string;
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  icon?: string | null;
  active?: boolean;
  station?: "BARRA" | "COCINA";
  audience?: "AMBAS" | "WEB" | "SALA";
};

export function MenuCategoryForm({ category }: { category?: CategoryValues }) {
  const [state, action] = useActionState(saveMenuCategory, IDLE);

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-6">
      {category?.id && <input type="hidden" name="id" value={category.id} />}

      <Panel title="Datos de la categoría">
        <div className="flex flex-col gap-5">
          <Field
            label="Nombre"
            name="name"
            required
            defaultValue={category?.name}
            maxLength={80}
            placeholder="Cervezas de barril"
            error={state.errors?.name}
          />

          <Field
            label="Enlace amigable (slug)"
            name="slug"
            defaultValue={category?.slug ?? ""}
            maxLength={90}
            placeholder="Se genera solo a partir del nombre"
            hint="Se usa como ancla dentro de la página de la carta."
            error={state.errors?.slug}
          />

          <TextareaField
            label="Descripción"
            name="description"
            rows={3}
            maxLength={500}
            defaultValue={category?.description ?? ""}
            placeholder="Una frase que presente la categoría."
            error={state.errors?.description}
          />

          <ImageField
            label="Imagen de la categoría"
            name="imageUrl"
            preset="cover"
            aspect="aspect-4/3"
            defaultValue={category?.imageUrl}
            hint="Se muestra junto al título de la sección en la carta."
          />

          <SelectField
            label="Sale por la impresora de"
            name="station"
            defaultValue={category?.station ?? "COCINA"}
            hint="Adónde va la comanda cuando el garzón manda un producto de esta categoría."
            error={state.errors?.station}
          >
            <option value="COCINA">Cocina</option>
            <option value="BARRA">Barra</option>
          </SelectField>

          <SelectField
            label="En qué carta sale"
            name="audience"
            defaultValue={category?.audience ?? "AMBAS"}
            hint="La carta de la web es la vitrina pública y va sin precios. La de sala es la del QR de la mesa y la que usan los garzones en el POS."
            error={state.errors?.audience}
          >
            <option value="AMBAS">En las dos cartas</option>
            <option value="WEB">Solo en la carta de la web</option>
            <option value="SALA">Solo en la carta de sala (QR y POS)</option>
          </SelectField>

          <CheckboxField
            label="Categoría visible"
            name="active"
            defaultChecked={category?.active ?? true}
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5">
          <FormMessage state={state} />
          <SubmitButton className="self-start" pendingLabel="Guardando…">
            Guardar categoría
          </SubmitButton>
        </div>
      </Panel>
    </form>
  );
}

export type ProductValues = {
  id?: string;
  categoryId?: string;
  slug?: string;
  name?: string;
  description?: string | null;
  price?: string;
  imageUrl?: string | null;
  available?: boolean;
  featured?: boolean;
  tags?: string[];
  station?: "BARRA" | "COCINA" | "";
  promoPrice?: string;
  promoLabel?: string | null;
  promoStartsAt?: string;
  promoEndsAt?: string;
};

export function MenuProductForm({
  product,
  categories,
}: {
  product?: ProductValues;
  categories: Array<{ id: string; name: string }>;
}) {
  const [state, action] = useActionState(saveMenuProduct, IDLE);

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-6">
      {product?.id && <input type="hidden" name="id" value={product.id} />}

      <Panel title="Datos del producto">
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Nombre"
              name="name"
              required
              defaultValue={product?.name}
              maxLength={120}
              placeholder="Schop rubia 500cc"
              error={state.errors?.name}
            />

            <SelectField
              label="Categoría"
              name="categoryId"
              required
              defaultValue={product?.categoryId}
              error={state.errors?.categoryId}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>
          </div>

          <TextareaField
            label="Descripción"
            name="description"
            rows={3}
            maxLength={600}
            defaultValue={product?.description ?? ""}
            placeholder="Ingredientes o una breve descripción."
            error={state.errors?.description}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Precio"
              name="price"
              required
              inputMode="decimal"
              defaultValue={product?.price}
              placeholder="490"
              hint="En pesos. Usa coma para los centésimos."
              error={state.errors?.price}
            />

            <Field
              label="Etiquetas"
              name="tags"
              defaultValue={product?.tags?.join(", ") ?? ""}
              placeholder="vegano, sin gluten"
              hint="Separadas por comas."
              error={state.errors?.tags}
            />
          </div>

          <ImageField
            label="Foto del producto"
            name="imageUrl"
            preset="product"
            aspect="aspect-square"
            defaultValue={product?.imageUrl}
          />

          <div className="flex flex-col gap-3">
            <CheckboxField
              label="Disponible"
              name="available"
              defaultChecked={product?.available ?? true}
              hint="Si está sin stock, no aparece en la carta pública."
            />
            <CheckboxField
              label="Destacado"
              name="featured"
              defaultChecked={product?.featured ?? false}
              hint="Los destacados se muestran también en la portada."
            />
          </div>

          <Field
            label="Enlace amigable (slug)"
            name="slug"
            defaultValue={product?.slug ?? ""}
            maxLength={90}
            placeholder="Se genera solo"
            error={state.errors?.slug}
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5">
          <FormMessage state={state} />
          <SubmitButton className="self-start" pendingLabel="Guardando…">
            Guardar producto
          </SubmitButton>
        </div>
      </Panel>

      <Panel
        title="Promoción"
        description="El precio promocional rige en la carta de la web y en el POS de los garzones a la vez. No hay que cargarlo dos veces."
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Precio promocional"
              name="promoPrice"
              inputMode="decimal"
              defaultValue={product?.promoPrice ?? ""}
              placeholder="Vacío = sin promoción"
              hint="Debe ser menor que el precio normal."
              error={state.errors?.promoPrice}
            />

            <Field
              label="Etiqueta"
              name="promoLabel"
              defaultValue={product?.promoLabel ?? ""}
              maxLength={40}
              placeholder="Happy hour"
              hint="Se imprime en la cuenta junto al descuento."
              error={state.errors?.promoLabel}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Desde"
              name="promoStartsAt"
              type="datetime-local"
              defaultValue={product?.promoStartsAt ?? ""}
              hint="Vacío = ya está vigente."
              error={state.errors?.promoStartsAt}
            />

            <Field
              label="Hasta"
              name="promoEndsAt"
              type="datetime-local"
              defaultValue={product?.promoEndsAt ?? ""}
              hint="Vacío = sin fecha de término."
              error={state.errors?.promoEndsAt}
            />
          </div>

          <SelectField
            label="Impresora"
            name="station"
            defaultValue={product?.station ?? ""}
            hint="Vacío = sigue a su categoría. Se cambia solo para las excepciones."
            error={state.errors?.station}
          >
            <option value="">Según la categoría</option>
            <option value="COCINA">Cocina</option>
            <option value="BARRA">Barra</option>
          </SelectField>
        </div>
      </Panel>
    </form>
  );
}
