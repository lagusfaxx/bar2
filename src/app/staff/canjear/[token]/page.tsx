import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutPanel } from "@/app/actions/auth";
import { Logo } from "@/components/brand/logo";
import { VoucherRedeemer } from "@/components/staff/voucher-redeemer";
import { getPanelSession } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { lookupVoucher } from "@/lib/vouchers";

export const dynamic = "force-dynamic";

/**
 * Destino del QR de un cupon de descuento.
 *
 * El socio eligio la promocion en su BarzuCard; escanear su pantalla trae al
 * equipo de sala directo aca, con el descuento ya resuelto. Es un paso menos
 * que el flujo por tarjeta, donde habia que buscar la promocion en una lista
 * sin saber cual queria el cliente.
 */
export default async function CanjearCuponPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [{ token }, session] = await Promise.all([params, getPanelSession()]);

  if (!session) {
    redirect(`/staff/login?volver=/staff/canjear/${encodeURIComponent(token)}`);
  }

  const [settings, voucher] = await Promise.all([
    getSettings(),
    lookupVoucher({ token }),
  ]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/staff"
            aria-label="Volver a la verificación"
            className="flex size-10 items-center justify-center border border-line text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>

          <Logo src={settings.logoUrl} name={settings.barName} variant="compact" />

          <form action={logoutPanel}>
            <button
              type="submit"
              aria-label="Cerrar sesión"
              className="flex size-10 items-center justify-center border border-line text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        {voucher ? (
          <VoucherRedeemer voucher={voucher} />
        ) : (
          <div className="border border-crimson/50 bg-crimson/10 p-6">
            <p className="font-display text-xl text-crimson-bright">
              Cupón no encontrado
            </p>
            <p className="mt-2 text-sm text-muted">
              Este código QR no corresponde a ningún cupón. Pídele al socio que
              vuelva a elegir el descuento desde su {settings.loyaltyTitle}.
            </p>
            <Link
              href="/staff"
              className="mt-5 inline-block text-sm text-crimson-bright underline-offset-4 hover:underline"
            >
              Buscar por número de tarjeta
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
