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

          {/* El campo escondido, por lo mismo que en el formulario del
              producto: sin el, desmarcar la casilla no apagaba nada. */}
          <input type="hidden" name="active" value="" />
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
  publicMenu?: boolean;
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

          {/*
            Cada casilla lleva delante un campo escondido con el valor
            "apagado".

            Un `checkbox` sin marcar no manda nada, asi que al guardar el
            servidor no podia distinguir "lo desmarque" de "ese campo no venia
            en el formulario" y dejaba el valor anterior: desmarcar "Disponible"
            no apagaba nada. Con el campo escondido siempre viaja un valor, y el
            de la casilla lo pisa cuando esta marcada.
          */}
          <div className="flex flex-col gap-3">
            <input type="hidden" name="available" value="" />
            <CheckboxField
              label="Disponible"
              name="available"
              defaultChecked={product?.available ?? true}
              hint="Si está sin stock, no aparece en ninguna carta ni en el POS."
            />

            <input type="hidden" name="publicMenu" value="" />
            <CheckboxField
              label="Mostrar en la carta pública de la web"
              name="publicMenu"
              defaultChecked={product?.publicMenu ?? true}
              hint="Desmárcalo y el producto desaparece de barzuo.cl/carta y de la portada. Sigue apareciendo en la carta del QR de la mesa y en el POS de los garzones, así que se puede vender igual."
            />

            <input type="hidden" name="featured" value="" />
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
