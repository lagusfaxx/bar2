"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { deleteEvent, saveEvent } from "@/app/actions/admin/events";
import { ActionButton } from "@/components/admin/action-button";
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
import { EVENT_CATEGORY_LABELS } from "@/lib/format";
import { IDLE } from "@/lib/form-state";

export type EventFormValues = {
  id?: string;
  slug?: string;
  title?: string;
  artist?: string | null;
  category?: string;
  excerpt?: string | null;
  description?: string | null;
  posterUrl?: string | null;
  coverUrl?: string | null;
  startsAt?: string;
  doorsAt?: string;
  endsAt?: string;
  isFree?: boolean;
  price?: string;
  ticketUrl?: string | null;
  capacity?: number | null;
  published?: boolean;
  featured?: boolean;
  ratingLock?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
};

export function EventForm({ event }: { event?: EventFormValues }) {
  const [state, action] = useActionState(saveEvent, IDLE);
  const [isFree, setIsFree] = useState(event?.isFree ?? true);

  return (
    <form action={action} className="flex flex-col gap-6">
      {event?.id && <input type="hidden" name="id" value={event.id} />}

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          <Panel title="Datos del show">
            <div className="flex flex-col gap-5">
              <Field
                label="Título"
                name="title"
                required
                defaultValue={event?.title}
                maxLength={160}
                placeholder="Tributo a Soda Stereo"
                error={state.errors?.title}
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Artista o banda"
                  name="artist"
                  defaultValue={event?.artist ?? ""}
                  maxLength={160}
                  placeholder="Nada Personal"
                  error={state.errors?.artist}
                />

                <SelectField
                  label="Categoría"
                  name="category"
                  defaultValue={event?.category ?? "EN_VIVO"}
                  error={state.errors?.category}
                >
                  {Object.entries(EVENT_CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
              </div>

              <Field
                label="Enlace amigable (slug)"
                name="slug"
                defaultValue={event?.slug ?? ""}
                maxLength={90}
                placeholder="Se genera solo a partir del título"
                hint="La dirección pública será /eventos/[slug]."
                error={state.errors?.slug}
              />

              <TextareaField
                label="Resumen"
                name="excerpt"
                rows={3}
                maxLength={400}
                defaultValue={event?.excerpt ?? ""}
                placeholder="Una o dos frases para la tarjeta de la cartelera."
                error={state.errors?.excerpt}
              />

              <TextareaField
                label="Descripción completa"
                name="description"
                rows={10}
                defaultValue={event?.description ?? ""}
                placeholder="Cuenta de qué se trata la noche. Separa los párrafos con una línea en blanco."
                hint="Se muestra en la página del evento."
                error={state.errors?.description}
              />
            </div>
          </Panel>

          <Panel
            title="Fecha y entrada"
            description="Los horarios se cargan en hora de Santiago."
          >
            <div className="flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-3">
                <Field
                  label="Inicio del show"
                  name="startsAt"
                  type="datetime-local"
                  required
                  defaultValue={event?.startsAt}
                  error={state.errors?.startsAt}
                />
                <Field
                  label="Apertura de puertas"
                  name="doorsAt"
                  type="datetime-local"
                  defaultValue={event?.doorsAt}
                  error={state.errors?.doorsAt}
                />
                <Field
                  label="Fin (opcional)"
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={event?.endsAt}
                  error={state.errors?.endsAt}
                />
              </div>

              <CheckboxField
                label="Entrada libre (evento gratuito)"
                name="isFree"
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
              />

              {!isFree && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Precio de la entrada"
                    name="price"
                    inputMode="decimal"
                    defaultValue={event?.price}
                    placeholder="650"
                    hint="En pesos. Usa coma para los centésimos."
                    error={state.errors?.price}
                  />
                  <Field
                    label="Link de venta de entradas"
                    name="ticketUrl"
                    type="url"
                    defaultValue={event?.ticketUrl ?? ""}
                    placeholder="https://…"
                    error={state.errors?.ticketUrl}
                  />
                </div>
              )}

              <Field
                label="Capacidad"
                name="capacity"
                type="number"
                min={0}
                defaultValue={event?.capacity ?? ""}
                placeholder="Opcional"
                error={state.errors?.capacity}
              />
            </div>
          </Panel>

          <Panel
            title="SEO del evento"
            description="Si lo dejas vacío usamos el título y el resumen."
          >
            <div className="flex flex-col gap-5">
              <Field
                label="Título SEO"
                name="seoTitle"
                maxLength={180}
                defaultValue={event?.seoTitle ?? ""}
                error={state.errors?.seoTitle}
              />
              <TextareaField
                label="Descripción SEO"
                name="seoDescription"
                rows={3}
                maxLength={400}
                defaultValue={event?.seoDescription ?? ""}
                error={state.errors?.seoDescription}
              />
              <ImageField
                label="Imagen para redes (Open Graph)"
                name="ogImageUrl"
                preset="cover"
                aspect="aspect-16/9"
                defaultValue={event?.ogImageUrl}
                hint="Recomendado 1200×630. Si no cargas una, usamos el afiche."
              />
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Publicación">
            <div className="flex flex-col gap-4">
              <CheckboxField
                label="Publicado en la web"
                name="published"
                defaultChecked={event?.published ?? false}
                hint="Si está desmarcado, queda como borrador y no se ve."
              />
              <CheckboxField
                label="Destacar en la cartelera"
                name="featured"
                defaultChecked={event?.featured ?? false}
              />
              <CheckboxField
                label="Cerrar calificaciones"
                name="ratingLock"
                defaultChecked={event?.ratingLock ?? false}
                hint="Impide que el público deje nuevas reseñas."
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5">
              <FormMessage state={state} />
              <SubmitButton className="w-full" pendingLabel="Guardando…">
                Guardar evento
              </SubmitButton>

              {event?.id && event.slug && (
                <Link
                  href={`/eventos/${event.slug}`}
                  target="_blank"
                  className="flex items-center justify-center gap-2 text-xs text-muted transition-colors hover:text-crimson-bright"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Ver en el sitio
                </Link>
              )}
            </div>
          </Panel>

          <Panel title="Imágenes">
            <div className="flex flex-col gap-6">
              <ImageField
                label="Afiche (vertical)"
                name="posterUrl"
                preset="poster"
                aspect="aspect-5/7"
                defaultValue={event?.posterUrl}
                hint="Proporción 5:7. Es la imagen de la tarjeta y del detalle."
              />
              <ImageField
                label="Portada (horizontal)"
                name="coverUrl"
                preset="cover"
                aspect="aspect-16/9"
                defaultValue={event?.coverUrl}
                hint="Opcional, para cabeceras anchas."
              />
            </div>
          </Panel>

          {event?.id && (
            <Panel title="Zona sensible">
              <p className="mb-4 text-xs text-muted">
                Eliminar el evento borra también sus reseñas. No se puede
                deshacer.
              </p>
              <ActionButton
                variant="danger"
                confirm={`¿Eliminar "${event.title}"? Esta acción no se puede deshacer.`}
                title="Eliminar evento"
                aria-label="Eliminar evento"
                action={async () => {
                  await deleteEvent(event.id!);
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </ActionButton>
            </Panel>
          )}
        </div>
      </div>
    </form>
  );
}
