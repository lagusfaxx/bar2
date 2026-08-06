import { Check, Gift, QrCode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MemberRegisterForm } from "@/components/barzucard/member-forms";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { getMemberSession } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Pedir mi BarzuCard",
  description:
    "Regístrate gratis y recibe tu BarzuCard con código QR y número único para canjear beneficios en BARZUO.",
};

/**
 * Lo que se lleva quien se registra, en tres líneas.
 *
 * Van arriba del formulario y no en una columna al costado: en el teléfono esa
 * columna terminaba debajo del botón de enviar, donde ya no convence a nadie.
 */
const VENTAJAS = [
  {
    icon: QrCode,
    text: "Tu QR queda activo al instante, en el teléfono.",
  },
  {
    icon: Gift,
    text: "Los descuentos se aplican en la mesa, al pedir.",
  },
  {
    icon: Check,
    text: "Gratis, sin costo de mantención y sin vencimiento.",
  },
];

export default async function RegistroPage() {
  const session = await getMemberSession();

  // Quien ya tiene sesión va directo a su tarjeta.
  if (session) redirect("/barzucard/tarjeta");

  const settings = await getSettings();

  return (
    <>
      <PageHeader
        eyebrow="Registro"
        title="Pide tu BarzuCard"
        lead="Es gratis y toma menos de un minuto. Al terminar tienes tu tarjeta con QR lista para usar esta misma noche."
        image="/demo/promo-3.jpg"
      />

      <Section className="container-bz">
        <div className="mx-auto flex max-w-xl flex-col gap-8">
          {/* Quien ya es socio no tiene que leer nada mas: la salida va
              primero, no al final de la pagina. */}
          <p className="flex flex-wrap items-center justify-between gap-3 border border-line bg-ink-soft px-5 py-4 text-sm text-muted">
            ¿Ya tienes cuenta?
            <Link
              href="/barzucard/ingresar"
              className="text-crimson-bright underline-offset-4 hover:underline"
            >
              Iniciar sesión
            </Link>
          </p>

          <ul className="flex flex-col gap-3">
            {VENTAJAS.map((ventaja) => (
              <li
                key={ventaja.text}
                className="flex items-start gap-3 text-sm text-bone-dim"
              >
                <ventaja.icon
                  className="mt-0.5 size-4 shrink-0 text-crimson"
                  aria-hidden
                />
                {ventaja.text}
              </li>
            ))}
          </ul>

          {/* El formulario, dentro de su caja: antes los campos flotaban
              sueltos sobre el fondo mientras las notas al costado sí tenían
              recuadro, y la pantalla se leía como tres cosas sin relación. */}
          <div className="card-bz p-6 sm:p-8">
            <MemberRegisterForm loyaltyTitle={settings.loyaltyTitle} />
          </div>

          <div className="flex flex-col gap-3 border-t border-line pt-6 text-xs leading-relaxed text-muted-dark">
            <p>
              La tarjeta de plástico es opcional y cuesta{" "}
              <span className="text-bone-dim">
                {formatPrice(settings.cardPriceCents)}
              </span>
              . Los beneficios funcionan igual sin ella, desde el QR del
              teléfono.
            </p>
            <p>
              Usamos tu email solo para gestionar la tarjeta y, si lo autorizas,
              avisarte de la cartelera.{" "}
              <Link
                href="/legales"
                className="underline-offset-4 hover:text-bone-dim hover:underline"
              >
                Términos y privacidad
              </Link>
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
