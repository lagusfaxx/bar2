import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { getSettings } from "@/lib/content";
import { absoluteUrl } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();

  return {
    title: "Términos y privacidad",
    description: `Términos de uso, política de privacidad y condiciones del programa ${settings.loyaltyTitle} de ${settings.barName}.`,
    alternates: { canonical: absoluteUrl("/legales") },
    robots: { index: true, follow: true },
  };
}

export default async function LegalesPage() {
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        eyebrow="Legales"
        title="Términos y privacidad"
        lead={`Condiciones de uso del sitio de ${settings.barName} y del programa ${settings.loyaltyTitle}.`}
      />

      <Section className="container-bz">
        <div className="mx-auto flex max-w-3xl flex-col gap-12">
          <article>
            <h2 className="font-display text-2xl text-bone">Uso del sitio</h2>
            <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-muted">
              <p>
                Este sitio pertenece a {settings.barName}, ubicado en{" "}
                {settings.address}, {settings.addressCity}. La información de
                cartelera, carta y horarios se actualiza de forma permanente y
                puede cambiar sin aviso previo.
              </p>
              <p>
                Las imágenes y textos publicados son propiedad de{" "}
                {settings.barName} o se utilizan con autorización de sus
                autores. No está permitida su reproducción con fines
                comerciales sin consentimiento.
              </p>
            </div>
          </article>

          <article>
            <h2 className="font-display text-2xl text-bone">
              Privacidad y datos personales
            </h2>
            <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-muted">
              <p>
                Guardamos únicamente los datos que nos enviás de forma
                voluntaria: los del formulario de contacto y los del registro
                del programa {settings.loyaltyTitle}. Los usamos para
                responderte, gestionar tu tarjeta y, si lo autorizaste,
                enviarte novedades de la cartelera.
              </p>
              <p>
                Las contraseñas se almacenan cifradas y nunca en texto plano.
                No vendemos ni cedemos tus datos a terceros.
              </p>
              <p>
                Para calificar un evento registramos una huella anónima
                derivada de tu conexión, con el único fin de evitar
                calificaciones duplicadas. No permite identificarte.
              </p>
              <p>
                Podés solicitar la baja de tu cuenta o la eliminación de tus
                datos escribiendo a{" "}
                {settings.email ? (
                  <a
                    href={`mailto:${settings.email}`}
                    className="text-crimson-bright underline-offset-4 hover:underline"
                  >
                    {settings.email}
                  </a>
                ) : (
                  "nuestro correo de contacto"
                )}
                .
              </p>
            </div>
          </article>

          {settings.loyaltyEnabled && (
            <article>
              <h2 className="font-display text-2xl text-bone">
                Condiciones de {settings.loyaltyTitle}
              </h2>
              <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-muted">
                {settings.loyaltyTerms ? (
                  settings.loyaltyTerms
                    .split(/\n{2,}/)
                    .map((paragraph, index) => <p key={index}>{paragraph}</p>)
                ) : (
                  <p>
                    Consultá las condiciones de cada promoción en la sección{" "}
                    {settings.loyaltyTitle}.
                  </p>
                )}
              </div>
            </article>
          )}

          <article>
            <h2 className="font-display text-2xl text-bone">Consumo responsable</h2>
            <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-muted">
              <p>
                La venta de bebidas alcohólicas está prohibida a menores de 18
                años. Si vas a manejar, no tomes alcohol.
              </p>
            </div>
          </article>
        </div>
      </Section>
    </>
  );
}

/** Regeneracion periodica; el CMS ademas invalida al guardar. */
export const revalidate = 300;
