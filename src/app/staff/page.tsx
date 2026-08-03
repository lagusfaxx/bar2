import { ArrowRight, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutPanel } from "@/app/actions/auth";
import { Logo } from "@/components/brand/logo";
import { CardVerifier } from "@/components/staff/card-verifier";
import { getPanelSession } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await getPanelSession();

  if (!session) redirect("/staff/login");

  const [settings, todayCount] = await Promise.all([
    getSettings(),
    prisma.redemption.count({
      where: {
        redeemedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
  ]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4 px-4 py-3">
          <Logo src={settings.logoUrl} name={settings.barName} variant="compact" />

          <div className="flex items-center gap-2">
            {session.role !== "STAFF" && (
              <Link
                href="/admin"
                aria-label="Ir al panel administrativo"
                title="Panel administrativo"
                className="flex size-10 items-center justify-center border border-line text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
              >
                <Settings className="size-4" aria-hidden />
              </Link>
            )}

            <form action={logoutPanel}>
              <button
                type="submit"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="flex size-10 items-center justify-center border border-line text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
              >
                <LogOut className="size-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        <div className="mb-6">
          <h1 className="font-display text-2xl text-bone">
            Verificar {settings.loyaltyTitle}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Escanea el QR que te muestra el cliente. Si es el cupón de un
            descuento, te lleva directo a confirmarlo; si es la tarjeta, se
            listan sus beneficios.
          </p>
          <p className="mt-3 text-xs text-muted-dark">
            {session.name} · {todayCount} canje{todayCount === 1 ? "" : "s"} hoy
          </p>
        </div>

        <CardVerifier />

        <Link
          href="/staff/pos"
          className="mt-8 flex items-center justify-between gap-3 border border-line bg-ink-soft px-4 py-4 transition-colors hover:border-crimson"
        >
          <span>
            <span className="block font-display text-lg text-bone">Sala</span>
            <span className="block text-xs text-muted">
              Abrir mesas, tomar pedidos y cobrar
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-muted" aria-hidden />
        </Link>
      </main>
    </>
  );
}
