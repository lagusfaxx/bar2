"use client";

import { useActionState, useEffect, useRef } from "react";

import { saveGalleryImage } from "@/app/actions/admin/content";
import { ImageField } from "@/components/admin/image-field";
import { Panel } from "@/components/admin/ui";
import {
  CheckboxField,
  Field,
  FormMessage,
  SelectField,
  SubmitButton,
} from "@/components/ui/form";
import { IDLE } from "@/lib/form-state";

const TAGS = ["ambiente", "shows", "público", "cocina", "barra"];

export function GalleryUploader({
  events,
}: {
  events: Array<{ id: string; title: string }>;
}) {
  const [state, action] = useActionState(saveGalleryImage, IDLE);
  const formRef = useRef<HTMLFormElement>(null);

  // Tras guardar, el formulario vuelve a cero para poder cargar otra foto
  // sin recargar la página.
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <Panel
      title="Subir una imagen"
      description="La foto se optimiza y se guarda automáticamente en formato WebP."
    >
      <form
        ref={formRef}
        action={action}
        // `key` fuerza a remontar ImageField (que tiene estado propio) tras
        // un guardado exitoso.
        key={state.status === "success" ? Date.now() : "form"}
        className="flex flex-col gap-5"
      >
        <ImageField
          label="Imagen"
          name="url"
          preset="gallery"
          aspect="aspect-4/3"
          required
          hint="JPG, PNG o WebP, hasta 10 MB."
          error={state.errors?.url}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Texto alternativo"
            name="alt"
            required
            maxLength={200}
            placeholder="Público durante un show en vivo"
            hint="Describe la imagen para lectores de pantalla y buscadores."
            error={state.errors?.alt}
          />

          <Field
            label="Epígrafe"
            name="caption"
            maxLength={200}
            placeholder="Sábado de tributo"
            error={state.errors?.caption}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="Categoría" name="tag" error={state.errors?.tag}>
            <option value="">Sin categoría</option>
            {TAGS.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Evento relacionado"
            name="eventId"
            error={state.errors?.eventId}
          >
            <option value="">Ninguno</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="flex flex-col gap-3">
          <CheckboxField
            label="Destacada"
            name="featured"
            hint="Las destacadas se muestran en la portada y en Nosotros."
          />
          <CheckboxField label="Visible en la galería" name="active" defaultChecked />
        </div>

        <FormMessage state={state} />

        <SubmitButton className="self-start" pendingLabel="Guardando…">
          Agregar a la galería
        </SubmitButton>
      </form>
    </Panel>
  );
}
