"use client";

import { useActionState, useState } from "react";

import { saveSettings } from "@/app/actions/admin/content";
import { ImageField } from "@/components/admin/image-field";
import { Panel } from "@/components/admin/ui";
import { VideoField } from "@/components/admin/video-field";
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
  heroImageMobileUrl: string | null;
  heroVideoUrl: string | null;
  heroCtaLabel: string | null;
  heroCtaHref: string | null;
  heroCtaSecondaryLabel: string | null;
  heroCtaSecondaryHref: string | null;
  heroVideoPosterUrl: string | null;
  marqueeText: string | null;
  homeEventsEyebrow: string | null;
  homeEventsTitle: string | null;
  homeEventsLead: string | null;
  homeMenuEyebrow: string | null;
  homeMenuTitle: string | null;
  homeMenuLead: string | null;
  homeLoyaltyTitle: string | null;
  homeGalleryEyebrow: string | null;
  homeGalleryTitle: string | null;
  homeGalleryLead: string | null;
  homeLocationEyebrow: string | null;
  homeLocationTitle: string | null;
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
  notifyEmails: string | null;
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
  cardPriceCents: number;
  cardPaymentInfo: string | null;
  cardPickupInfo: string | null;
};

const TABS = [
  { id: "identidad", label: "Identidad" },
  { id: "portada", label: "Portada" },
  { id: "home", label: "Secciones del inicio" },
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
              label="Imagen de fondo (escritorio)"
              name="heroImageUrl"
              preset="cover"
              aspect="aspect-16/9"
              defaultValue={settings.heroImageUrl}
              hint="Horizontal. El sitio ya le pone un velo oscuro encima para que se lea el logotipo, así que elige una foto con luz: si la subes muy oscura, la portada se ve negra."
            />

            <ImageField
              label="Imagen de fondo (teléfono)"
              name="heroImageMobileUrl"
              preset="cover"
              aspect="aspect-9/16"
              defaultValue={settings.heroImageMobileUrl}
              hint="Vertical. Sin ella, en el teléfono se recorta la horizontal a su franja central, que casi nunca es la parte interesante de la foto."
            />

            <VideoField
              label="Video de fondo"
              name="heroVideoUrl"
              defaultValue={settings.heroVideoUrl}
              hint="Opcional. Si subes un video, reemplaza a la imagen. MP4, WebM o MOV de hasta 32 MB; lo ideal es un clip corto (10 a 20 segundos) que se repita sin cortes. Va sin sonido."
              error={state.errors?.heroVideoUrl}
            />

            <ImageField
              label="Imagen mientras carga el video"
              name="heroVideoPosterUrl"
              preset="cover"
              aspect="aspect-16/9"
              defaultValue={settings.heroVideoPosterUrl}
              hint="Solo si usas video: es lo que se ve el primer instante. Si la dejas vacía usamos la imagen de fondo."
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

      <div hidden={tab !== "home"}>
        <Panel
          title="Secciones de la página de inicio"
          description="Los títulos que se ven en la portada. Si dejas un campo vacío, se muestra el texto que trae el sitio por defecto."
        >
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-5">
              <TextareaField
                label="Cintillo animado"
                name="marqueeText"
                rows={4}
                maxLength={600}
                defaultValue={settings.marqueeText ?? ""}
                hint="La franja de palabras que se desplaza bajo la portada. Escribe una palabra o frase por línea; se repiten en bucle."
                error={state.errors?.marqueeText}
              />
            </div>

            <div className="flex flex-col gap-5 border-t border-line pt-6">
              <p className="text-[0.68rem] font-medium tracking-[0.18em] text-bone-dim uppercase">
                Bloque de la cartelera
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Etiqueta superior"
                  name="homeEventsEyebrow"
                  defaultValue={settings.homeEventsEyebrow ?? ""}
                  placeholder="Cartelera"
                  error={state.errors?.homeEventsEyebrow}
                />
                <Field
                  label="Título"
                  name="homeEventsTitle"
                  defaultValue={settings.homeEventsTitle ?? ""}
                  placeholder="Lo que se viene"
                  error={state.errors?.homeEventsTitle}
                />
              </div>
              <TextareaField
                label="Bajada"
                name="homeEventsLead"
                rows={2}
                maxLength={400}
                defaultValue={settings.homeEventsLead ?? ""}
                error={state.errors?.homeEventsLead}
              />
            </div>

            <div className="flex flex-col gap-5 border-t border-line pt-6">
              <p className="text-[0.68rem] font-medium tracking-[0.18em] text-bone-dim uppercase">
                Bloque de la carta
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Etiqueta superior"
                  name="homeMenuEyebrow"
                  defaultValue={settings.homeMenuEyebrow ?? ""}
                  placeholder="La carta"
                  error={state.errors?.homeMenuEyebrow}
                />
                <Field
                  label="Título"
                  name="homeMenuTitle"
                  defaultValue={settings.homeMenuTitle ?? ""}
                  placeholder="Para acompañar la noche"
                  error={state.errors?.homeMenuTitle}
                />
              </div>
              <TextareaField
                label="Bajada"
                name="homeMenuLead"
                rows={2}
                maxLength={400}
                defaultValue={settings.homeMenuLead ?? ""}
                error={state.errors?.homeMenuLead}
              />
            </div>

            <div className="flex flex-col gap-5 border-t border-line pt-6">
              <p className="text-[0.68rem] font-medium tracking-[0.18em] text-bone-dim uppercase">
                Bloque de la BarzuCard
              </p>
              <Field
                label="Título"
                name="homeLoyaltyTitle"
                defaultValue={settings.homeLoyaltyTitle ?? ""}
                placeholder="Tu tarjeta de beneficios"
                hint="La bajada de este bloque es la descripción del programa, en la pestaña BarzuCard."
                error={state.errors?.homeLoyaltyTitle}
              />
            </div>

            <div className="flex flex-col gap-5 border-t border-line pt-6">
              <p className="text-[0.68rem] font-medium tracking-[0.18em] text-bone-dim uppercase">
                Bloque de la galería
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Etiqueta superior"
                  name="homeGalleryEyebrow"
                  defaultValue={settings.homeGalleryEyebrow ?? ""}
                  placeholder="Galería"
                  error={state.errors?.homeGalleryEyebrow}
                />
                <Field
                  label="Título"
                  name="homeGalleryTitle"
                  defaultValue={settings.homeGalleryTitle ?? ""}
                  placeholder="Noches que quedan"
                  error={state.errors?.homeGalleryTitle}
                />
              </div>
              <TextareaField
                label="Bajada"
                name="homeGalleryLead"
                rows={2}
                maxLength={400}
                defaultValue={settings.homeGalleryLead ?? ""}
                error={state.errors?.homeGalleryLead}
              />
            </div>

            <div className="flex flex-col gap-5 border-t border-line pt-6">
              <p className="text-[0.68rem] font-medium tracking-[0.18em] text-bone-dim uppercase">
                Bloque de la ubicación
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Etiqueta superior"
                  name="homeLocationEyebrow"
                  defaultValue={settings.homeLocationEyebrow ?? ""}
                  placeholder="Ubicación"
                  error={state.errors?.homeLocationEyebrow}
                />
                <Field
                  label="Título"
                  name="homeLocationTitle"
                  defaultValue={settings.homeLocationTitle ?? ""}
                  placeholder="Te esperamos"
                  error={state.errors?.homeLocationTitle}
                />
              </div>
              <p className="text-xs text-muted-dark">
                La dirección que aparece debajo sale de la pestaña «Contacto y
                ubicación».
              </p>
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

            {/* Distinto del email de contacto de arriba: ese es el que se
                publica en el sitio, este es el que recibe los avisos. Suelen
                ser el mismo, pero no tienen por que serlo — y quien atiende las
                reservas casi nunca es la casilla que sale en la web. */}
            <Field
              label="Avisar mensajes nuevos a"
              name="notifyEmails"
              defaultValue={settings.notifyEmails ?? ""}
              placeholder="hola@barzuo.com, reservas@barzuo.com"
              hint="Separa varias direcciones con coma. A cada una le llega su propia copia."
              error={state.errors?.notifyEmails}
            />

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

        <div className="mt-6">
          <Panel
            title="Tarjeta física: pago y retiro"
            description="Lo que ve el socio cuando pide su tarjeta. El seguimiento de cada pago se hace en Socios y tarjetas."
          >
            <div className="flex flex-col gap-5">
              <Field
                label="Precio de la tarjeta"
                name="cardPrice"
                defaultValue={(settings.cardPriceCents / 100).toLocaleString("es-CL")}
                placeholder="5.500"
                hint="Solo el monto, sin el signo. Déjalo en 0 si la tarjeta es gratuita."
                error={state.errors?.cardPrice}
              />

              <TextareaField
                label="Datos para la transferencia"
                name="cardPaymentInfo"
                rows={6}
                maxLength={1200}
                defaultValue={settings.cardPaymentInfo ?? ""}
                hint="Banco, tipo de cuenta, número, nombre, documento y correo de aviso. Se muestran tal cual al socio."
                error={state.errors?.cardPaymentInfo}
              />

              <TextareaField
                label="Cómo se retira"
                name="cardPickupInfo"
                rows={4}
                maxLength={1200}
                defaultValue={settings.cardPickupInfo ?? ""}
                hint="Por ejemplo: días y horarios en que puede pasar a buscarla y qué tiene que mostrar."
                error={state.errors?.cardPickupInfo}
              />
            </div>
          </Panel>
        </div>
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
