import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MemberRegisterForm } from "@/components/barzucard/member-forms";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { getMemberSession } from "@/lib/auth";
import { getSettings } from "@/lib/content";

export const metadata: Metadata = {
  title: "Pedir mi BarzuCard",
  description:
    "Registrate gratis y recibí tu BarzuCard con código QR y número único para canjear beneficios en BARZUO.",
};

export default async function RegistroPage() {
  const session = await getMemberSession();

  // Quien ya tiene sesión va directo a su tarjeta.
  if (session) redirect("/barzucard/tarjeta");

  const settings = await getSettings();

  return (
    <>
      <PageHeader
        eyebrow="Registro"
        title="Pedí tu BarzuCard"
        lead="Es gratis. Completá tus datos y te emitimos la tarjeta al instante, con su QR y su número único."
        image="/demo/promo-3.jpg"
      />

      <Section className="container-bz">
        <div className="mx-auto grid max-w-4xl gap-12 lg:grid-cols-[1fr_18rem]">
          <div>
            <MemberRegisterForm loyaltyTitle={settings.loyaltyTitle} />
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="card-bz p-6">
              <h2 className="eyebrow mb-4 text-bone">¿Ya tenés cuenta?</h2>
              <p className="text-sm text-muted">
                Ingresá con tu email y accedé a tu tarjeta desde cualquier
                dispositivo.
              </p>
              <Link
                href="/barzucard/ingresar"
                className="mt-4 inline-block text-sm text-crimson-bright underline-offset-4 hover:underline"
              >
                Iniciar sesión
              </Link>
            </div>

            <div className="card-bz mt-6 p-6">
              <h2 className="eyebrow mb-4 text-bone">Tus datos</h2>
              <p className="text-sm leading-relaxed text-muted">
                Usamos tu email solo para gestionar la tarjeta y, si lo
                autorizás, avisarte de la cartelera. Podés darte de baja cuando
                quieras.
              </p>
              <Link
                href="/legales"
                className="mt-4 inline-block text-xs text-muted-dark underline-offset-4 hover:text-bone-dim hover:underline"
              >
                Ver términos y privacidad
              </Link>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
