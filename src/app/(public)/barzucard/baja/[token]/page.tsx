import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { verifyUnsubscribeToken } from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Darse de baja",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Baja de las novedades, en un solo paso.
 *
 * Sin pedir contrasena y sin botones de confirmacion. Quien llega aca ya
 * decidio, y ponerle trabas es exactamente lo que hace que en vez de darse de
 * baja marque el correo como no deseado — que es mucho peor: castiga al
 * dominio entero y con el se cae tambien el correo de las tarjetas y el de
 * recuperar la cuenta.
 *
 * Solo se apagan las novedades. La cuenta, la tarjeta y los beneficios siguen
 * intactos, y los correos de servicio —la tarjeta, la recuperacion— tambien:
 * nadie pidio dejar de recibir su propia tarjeta.
 */
export default async function BajaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const memberId = verifyUnsubscribeToken(token);

  const member = memberId
    ? await prisma.member.findUnique({
        where: { id: memberId },
        select: { id: true, email: true, acceptsNews: true },
      })
    : null;

  // La baja ocurre al abrir la pagina, no al apretar un boton.
  if (member?.acceptsNews) {
    await prisma.member.update({
      where: { id: member.id },
      data: { acceptsNews: false },
    });
  }

  if (!member) {
    return (
      <>
        <PageHeader
          eyebrow="BarzuCard"
          title="No pudimos identificar el enlace"
          lead="Puede que esté incompleto por cómo lo cortó el correo."
        />

        <Section className="container-bz">
          <div className="mx-auto max-w-md text-center text-sm text-muted">
            <p>
              Entra a tu cuenta y desmarca «Quiero recibir novedades», o
              respóndenos el correo y lo hacemos nosotros.
            </p>

            <Link
              href="/barzucard/ingresar"
              className="mt-6 inline-flex h-12 items-center justify-center bg-crimson px-6 text-base font-medium text-bone"
            >
              Entrar a mi cuenta
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
        title="Listo, no te escribimos más"
        lead={`Dimos de baja a ${member.email} de las novedades.`}
      />

      <Section className="container-bz">
        <div className="mx-auto max-w-md text-center">
          <p className="text-sm text-muted">
            Tu tarjeta y tus beneficios siguen igual: esto solo apaga los correos
            de promociones. Si algún día quieres volver, se activa desde tu
            cuenta.
          </p>

          <Link
            href="/barzucard/tarjeta"
            className="mt-6 inline-flex h-12 items-center justify-center border border-line px-6 text-base text-bone-dim transition-colors hover:border-crimson hover:text-bone"
          >
            Ver mi tarjeta
          </Link>
        </div>
      </Section>
    </>
  );
}
