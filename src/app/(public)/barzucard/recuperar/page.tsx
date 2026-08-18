import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RequestResetForm } from "@/components/barzucard/member-forms";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { getMemberSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Recuperar mi cuenta",
  robots: { index: false, follow: false },
};

export default async function RecuperarPage() {
  // Con la sesion abierta esta pagina no tiene sentido: se cambia la clave
  // desde la cuenta, sin pasar por el correo.
  if (await getMemberSession()) redirect("/barzucard/tarjeta");

  return (
    <>
      <PageHeader
        eyebrow="BarzuCard"
        title="Volver a entrar"
        lead="Te mandamos un enlace al correo para que elijas una contraseña nueva."
      />

      <Section className="container-bz">
        <div className="mx-auto max-w-md">
          <div className="card-bz p-7 sm:p-8">
            <RequestResetForm />
          </div>

          <p className="mt-8 text-center text-sm text-muted">
            <Link
              href="/barzucard/ingresar"
              className="text-crimson-bright underline-offset-4 hover:underline"
            >
              Volver a ingresar
            </Link>
          </p>
        </div>
      </Section>
    </>
  );
}
