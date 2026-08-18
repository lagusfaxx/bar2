import type { Metadata } from "next";
import Link from "next/link";

import { findValidReset } from "@/lib/password-reset";
import { ResetPasswordForm } from "@/components/barzucard/member-forms";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Elegir contraseña nueva",
  robots: { index: false, follow: false },
};

/** El enlace se comprueba en cada visita: puede haber vencido o ya usarse. */
export const dynamic = "force-dynamic";

export default async function ElegirClavePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const reset = await findValidReset(token);

  /*
   * Enlace vencido o ya usado.
   *
   * Se explican los dos motivos posibles y se ofrece la salida en el mismo
   * lugar. Un "enlace invalido" a secas deja a la persona sin saber si se
   * equivoco al copiarlo, si expiro o si su cuenta tiene algun problema.
   */
  if (!reset) {
    return (
      <>
        <PageHeader
          eyebrow="BarzuCard"
          title="Este enlace ya no sirve"
          lead="Los enlaces duran un par de horas y se usan una sola vez."
        />

        <Section className="container-bz">
          <div className="mx-auto max-w-md text-center">
            <p className="text-sm text-muted">
              Puede que ya lo hayas usado, que haya vencido, o que hayas pedido
              otro después —en ese caso vale el último que te llegó—.
            </p>

            <Link
              href="/barzucard/recuperar"
              className="mt-6 inline-flex h-12 items-center justify-center bg-crimson px-6 text-base font-medium text-bone"
            >
              Pedir un enlace nuevo
            </Link>
          </div>
        </Section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="BarzuCard"
        title={`Hola, ${reset.member.fullName.split(" ")[0]}`}
        lead="Elige la contraseña con la que vas a entrar de ahora en adelante."
      />

      <Section className="container-bz">
        <div className="mx-auto max-w-md">
          <div className="card-bz p-7 sm:p-8">
            <ResetPasswordForm token={token} />
          </div>
        </div>
      </Section>
    </>
  );
}
