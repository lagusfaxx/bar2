import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/admin/login-form";
import { Logo } from "@/components/brand/logo";
import { getSettings } from "@/lib/content";

export const metadata: Metadata = {
  title: "Ingresar",
  robots: { index: false, follow: false },
};

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const [{ volver }, settings] = await Promise.all([searchParams, getSettings()]);

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/2 -z-10 size-[30rem] -translate-x-1/2 rounded-full bg-crimson/12 blur-[130px]"
      />

      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <Logo
            src={settings.logoUrl}
            name={settings.barName}
            tagline="Verificación de BarzuCard"
            variant="stacked"
            className="text-4xl"
          />
        </div>

        <div className="card-bz p-7 sm:p-8">
          <h1 className="font-display text-2xl text-bone">Ingresar</h1>
          <p className="mt-2 text-sm text-muted">
            Usa tu cuenta del equipo para validar tarjetas y canjear
            promociones.
          </p>

          <div className="mt-7">
            <LoginForm redirectTo={volver ?? "/staff"} />
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-dark">
          <Link href="/" className="underline-offset-4 hover:text-bone-dim hover:underline">
            Volver al sitio
          </Link>
        </p>
      </div>
    </main>
  );
}
