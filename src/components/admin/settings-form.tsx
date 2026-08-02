"use client";

import { useActionState, useState } from "react";

import { saveSettings } from "@/app/actions/admin/content";
import { ImageField } from "@/components/admin/image-field";
import { Panel } from "@/components/admin/ui";
import {
  CheckboxField,
  Field,
  FormMessage,
  SubmitButton,
  TextareaField,
} from "@/components/ui/form";
import { IDLE } from "@/lib/form-state";
import { cn } from "@/lib/utils";

type Settings = {
  barName: string;
  tagline: string;
  logoUrl: string | null;
  logoAltUrl: string | null;
  faviconUrl: string | null;
  heroTitle: string;
  heroEyebrow: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  heroVideoUrl: string | null;
  heroCtaLabel: string | null;
  heroCtaHref: string | null;
  heroCtaSecondaryLabel: string | null;
  heroCtaSecondaryHref: string | null;
  aboutTitle: string | null;
  aboutLead: string | null;
  aboutBody: string | null;
  aboutImageUrl: string | null;
  aboutSecondaryImageUrl: string | null;
  address: string;
  addressCity: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  reservationsNote: string | null;
  footerNote: string | null;
  seoTitle: string;
  seoDescription: string;
  seoImageUrl: string | null;
  seoKeywords: string | null;
  googleAnalyticsId: string | null;
  loyaltyEnabled: boolean;
  loyaltyTitle: string;
  loyaltyDescription: string | null;
  loyaltyTerms: string | null;
};

const TABS = [
  { id: "identidad", label: "Identidad" },
  { id: "portada", label: "Portada" },
  { id: "nosotros", label: "Nosotros" },
  { id: "contacto", label: "Contacto y ubicación" },
  { id: "seo", label: "SEO" },
  { id: "barzucard", label: "BarzuCard" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Formulario de ajustes. Todos los campos viven en un único <form> y las
 * pestañas solo ocultan visualmente cada bloque (con `hidden`), de modo que al
 * guardar se envía siempre el formulario completo aunque el administrador haya
 * cambiado de pestaña.
 */
export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action] = useActionState(saveSettings, IDLE);
  const [tab, setTab] = useState<TabId>("identidad");

  return (
    <form action={action} className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Secciones de ajustes"
        className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b border-line"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "shrink-0 border-b-2 px-4 py-3 text-[0.68rem] font-medium tracking-[0.16em] uppercase transition-colors",
              tab === item.id
                ? "border-crimson text-bone"
                : "border-transparent text-muted hover:text-bone",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div hidden={tab !== "identidad"}>
        <Panel title="Identidad del local">
          <div className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Nombre del bar"
                name="barName"
                required
                defaultValue={settings.barName}
                error={state.errors?.barName}
              />
              <Field
                label="Bajada / tagline"
                name="tagline"
                defaultValue={settings.tagline}
                placeholder="Bar · Lounge & Club"
                error={state.errors?.tagline}
              />
            </div>

            <ImageField
              label="Logotipo"
              name="logoUrl"
              preset="logo"
              aspect="aspect-3/1"
              defaultValue={settings.logoUrl}
              hint="PNG o SVG con fondo transparente. Si no cargas ninguno, usamos el logotipo tipográfico."
            />

            <ImageField
              label="Logotipo alternativo"
              name="logoAltUrl"
              preset="logo"
              aspect="aspect-3/1"
              defaultValue={settings.logoAltUrl}
              hint="Opcional, para fondos claros."
            />

            <ImageField
              label="Favicon"
              name="faviconUrl"
              preset="logo"
              aspect="aspect-square"
              defaultValue={settings.faviconUrl}
              hint="Cuadrado, idealmente 512×512."
            />

            <TextareaField
              label="Nota del pie de página"
              name="footerNote"
              rows={3}
              maxLength={600}
              defaultValue={settings.footerNote ?? ""}
              error={state.errors?.footerNote}
            />
          </div>
        </Panel>
      </div>

      <div hidden={tab !== "portada"}>
        <Panel title="Portada (hero)">
          <div className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Título principal"
                name="heroTitle"
                required
                defaultValue={settings.heroTitle}
                hint="Se muestra con la tipografía del logotipo."
                error={state.errors?.heroTitle}
              />
              <Field
                label="Etiqueta superior"
                name="heroEyebrow"
                defaultValue={settings.heroEyebrow ?? ""}
                placeholder="EST. 2024"
                error={state.errors?.heroEyebrow}
              />
            </div>

            <TextareaField
              label="Frase de presentación"
              name="heroSubtitle"
              rows={3}
              maxLength={400}
              defaultValue={settings.heroSubtitle ?? ""}
              error={state.errors?.heroSubtitle}
            />

            <ImageField
              label="Imagen de fondo"
              name="heroImageUrl"
              preset="cover"
              aspect="aspect-16/9"
              defaultValue={settings.heroImageUrl}
              hint="Horizontal y bien oscura: encima va el logotipo."
            />

            <Field
              label="Video de fondo (URL)"
              name="heroVideoUrl"
              defaultValue={settings.heroVideoUrl ?? ""}
              placeholder="https://…/loop.mp4"
              hint="Si lo completas, reemplaza a la imagen de fondo."
              error={state.errors?.heroVideoUrl}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Botón principal"
                name="heroCtaLabel"
                defaultValue={settings.heroCtaLabel ?? ""}
                error={state.errors?.heroCtaLabel}
              />
              <Field
                label="Enlace del botón principal"
                name="heroCtaHref"
                defaultValue={settings.heroCtaHref ?? ""}
                placeholder="/eventos"
                error={state.errors?.heroCtaHref}
              />
              <Field
                label="Botón secundario"
                name="heroCtaSecondaryLabel"
                defaultValue={settings.heroCtaSecondaryLabel ?? ""}
                error={state.errors?.heroCtaSecondaryLabel}
              />
              <Field
                label="Enlace del botón secundario"
                name="heroCtaSecondaryHref"
                defaultValue={settings.heroCtaSecondaryHref ?? ""}
                placeholder="/carta"
                error={state.errors?.heroCtaSecondaryHref}
              />
            </div>
          </div>
        </Panel>
      </div>

      <div hidden={tab !== "nosotros"}>
        <Panel title="Sección Nosotros">
          <div className="flex flex-col gap-5">
            <Field
              label="Título"
              name="aboutTitle"
              defaultValue={settings.aboutTitle ?? ""}
              error={state.errors?.aboutTitle}
            />

            <TextareaField
              label="Bajada"
              name="aboutLead"
              rows={3}
              maxLength={600}
              defaultValue={settings.aboutLead ?? ""}
              error={state.errors?.aboutLead}
            />

            <TextareaField
              label="Historia completa"
              name="aboutBody"
              rows={12}
              defaultValue={settings.aboutBody ?? ""}
              hint="Separa los párrafos con una línea en blanco."
              error={state.errors?.aboutBody}
            />

            <div className="grid gap-5 lg:grid-cols-2">
              <ImageField
                label="Imagen principal"
                name="aboutImageUrl"
                preset="cover"
                aspect="aspect-3/4"
                defaultValue={settings.aboutImageUrl}
              />
              <ImageField
                label="Imagen secundaria"
                name="aboutSecondaryImageUrl"
                preset="cover"
                aspect="aspect-4/3"
                defaultValue={settings.aboutSecondaryImageUrl}
              />
            </div>
          </div>
        </Panel>
      </div>

      <div hidden={tab !== "contacto"}>
        <Panel title="Contacto y ubicación">
          <div className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Dirección"
                name="address"
                required
                defaultValue={settings.address}
                error={state.errors?.address}
              />
              <Field
                label="Ciudad y país"
                name="addressCity"
                defaultValue={settings.addressCity}
                error={state.errors?.addressCity}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Latitud"
                name="latitude"
                required
                inputMode="decimal"
                defaultValue={settings.latitude}
                hint="Se usa para centrar el mapa."
                error={state.errors?.latitude}
              />
              <Field
                label="Longitud"
                name="longitude"
                required
                inputMode="decimal"
                defaultValue={settings.longitude}
                error={state.errors?.longitude}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field
                label="Teléfono"
                name="phone"
                defaultValue={settings.phone ?? ""}
                error={state.errors?.phone}
              />
              <Field
                label="WhatsApp"
                name="whatsapp"
                defaultValue={settings.whatsapp ?? ""}
                placeholder="+56912345678"
                error={state.errors?.whatsapp}
              />
              <Field
                label="Email"
                name="email"
                type="email"
                defaultValue={settings.email ?? ""}
                error={state.errors?.email}
              />
            </div>

            <TextareaField
              label="Nota sobre reservas"
              name="reservationsNote"
              rows={3}
              maxLength={600}
              defaultValue={settings.reservationsNote ?? ""}
              error={state.errors?.reservationsNote}
            />
          </div>
        </Panel>
      </div>

      <div hidden={tab !== "seo"}>
        <Panel
          title="SEO y redes"
          description="Cómo se ve el sitio en Google y al compartirlo."
        >
          <div className="flex flex-col gap-5">
            <Field
              label="Título SEO"
              name="seoTitle"
              required
              maxLength={180}
              defaultValue={settings.seoTitle}
              hint="Ideal entre 50 y 60 caracteres."
              error={state.errors?.seoTitle}
            />

            <TextareaField
              label="Descripción SEO"
              name="seoDescription"
              required
              rows={3}
              maxLength={400}
              defaultValue={settings.seoDescription}
              hint="Ideal entre 140 y 160 caracteres."
              error={state.errors?.seoDescription}
            />

            <ImageField
              label="Imagen para redes sociales"
              name="seoImageUrl"
              preset="cover"
              aspect="aspect-16/9"
              defaultValue={settings.seoImageUrl}
              hint="1200×630. Es la que se ve al compartir el enlace."
            />

            <Field
              label="Palabras clave"
              name="seoKeywords"
              maxLength={400}
              defaultValue={settings.seoKeywords ?? ""}
              placeholder="bar santiago, música en vivo, tributos"
              hint="Separadas por comas."
              error={state.errors?.seoKeywords}
            />

            <Field
              label="ID de Google Analytics"
              name="googleAnalyticsId"
              maxLength={40}
              defaultValue={settings.googleAnalyticsId ?? ""}
              placeholder="G-XXXXXXXXXX"
              error={state.errors?.googleAnalyticsId}
            />
          </div>
        </Panel>
      </div>

      <div hidden={tab !== "barzucard"}>
        <Panel title="Programa BarzuCard">
          <div className="flex flex-col gap-5">
            <CheckboxField
              label="Programa activo"
              name="loyaltyEnabled"
              defaultChecked={settings.loyaltyEnabled}
              hint="Si lo desactivas, se oculta de la web pública."
            />

            <Field
              label="Nombre del programa"
              name="loyaltyTitle"
              defaultValue={settings.loyaltyTitle}
              error={state.errors?.loyaltyTitle}
            />

            <TextareaField
              label="Descripción"
              name="loyaltyDescription"
              rows={4}
              maxLength={800}
              defaultValue={settings.loyaltyDescription ?? ""}
              error={state.errors?.loyaltyDescription}
            />

            <TextareaField
              label="Términos del programa"
              name="loyaltyTerms"
              rows={10}
              defaultValue={settings.loyaltyTerms ?? ""}
              hint="Se publican en la página de legales."
              error={state.errors?.loyaltyTerms}
            />
          </div>
        </Panel>
      </div>

      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-ink/95 py-4 backdrop-blur-xl">
        <FormMessage state={state} />
        <SubmitButton className="self-start" pendingLabel="Guardando…">
          Guardar ajustes
        </SubmitButton>
      </div>
    </form>
  );
}
