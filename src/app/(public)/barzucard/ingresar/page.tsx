import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MemberLoginForm } from "@/components/barzucard/member-forms";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { getMemberSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Ingresar a mi BarzuCard",
  robots: { index: false, follow: true },
};

export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const [session, { volver }] = await Promise.all([
    getMemberSession(),
    searchParams,
  ]);

  if (session) redirect(volver ?? "/barzucard/tarjeta");

  return (
    <>
      <PageHeader
        eyebrow="BarzuCard"
        title="Ingresar"
        lead="Accede a tu tarjeta, tus puntos y las promociones disponibles."
        image="/demo/promo-4.jpg"
      />

      <Section className="container-bz">
        <div className="mx-auto max-w-md">
          <div className="card-bz p-7 sm:p-8">
            <MemberLoginForm redirectTo={volver} />
          </div>

          <p className="mt-8 text-center text-sm text-muted">
            ¿Todavía no tienes BarzuCard?{" "}
            <Link
              href="/barzucard/registro"
              className="text-crimson-bright underline-offset-4 hover:underline"
            >
              Pedila gratis
            </Link>
          </p>
        </div>
      </Section>
    </>
  );
}
