import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/admin/login-form";
import { Logo } from "@/components/brand/logo";
import { getSettings } from "@/lib/content";

export const metadata: Metadata = {
  title: "Ingresar al panel",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const [{ volver }, settings] = await Promise.all([searchParams, getSettings()]);

  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-5 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/2 -z-10 size-[34rem] -translate-x-1/2 rounded-full bg-crimson/12 blur-[140px]"
      />

      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <Link href="/" aria-label="Volver al sitio">
            <Logo
              src={settings.logoUrl}
              name={settings.barName}
              tagline="Panel administrativo"
              variant="stacked"
              className="text-4xl"
            />
          </Link>
        </div>

        <div className="card-bz p-7 sm:p-8">
          <h1 className="font-display text-2xl text-bone">Ingresar</h1>
          <p className="mt-2 text-sm text-muted">
            Accedé con tu cuenta para administrar el contenido del sitio.
          </p>

          <div className="mt-7">
            <LoginForm redirectTo={volver} />
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-dark">
          ¿Sos parte del equipo de sala?{" "}
          <Link
            href="/staff/login"
            className="text-crimson-bright underline-offset-4 hover:underline"
          >
            Ingresá a la app de BarzuCard
          </Link>
        </p>
      </div>
    </main>
  );
}
