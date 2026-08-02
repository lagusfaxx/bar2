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
            placeholder="Coctelería de autor"
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

          <CheckboxField
            label="Categoría visible en la web"
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
              placeholder="Zuo Negroni"
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
    </form>
  );
}
