import { LogOut, Star, Utensils, Wine, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutPanel } from "@/app/actions/auth";
import { Logo } from "@/components/brand/logo";
import { TableGrid } from "@/components/staff/pos/table-grid";
import { getPanelSession } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { getTablesOverview } from "@/lib/pos";

/** Sala: el estado de las mesas cambia cada minuto, nunca se cachea. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sala",
};

export default async function PosPage() {
  const session = await getPanelSession();

  if (!session) redirect("/staff/login?volver=/staff/pos");

  const [settings, tables] = await Promise.all([
    getSettings(),
    getTablesOverview(),
  ]);

  return (
    <>
      {/*
        Cada boton dice lo que hace.

        Antes eran cuatro iconos pelados —un tenedor, una copa, una estrella y
        una puerta— con el nombre escondido en `title`, que en un telefono no
        se ve nunca: hay que dejar el dedo apoyado y ni siquiera entonces
        aparece. Quien usa esto aprendio a tocarlos de memoria o directamente
        no los toca. El icono se queda porque ayuda a encontrar el boton
        rapido, pero ahora acompaña a la palabra en vez de reemplazarla.

        Con las palabras puestas, los cuatro ya no entran al lado del logo en
        un telefono. En vez de recortarlos se bajan a su propia fila, repartida
        en partes iguales: se gana un renglon y se pierde la adivinanza.
      */}
      <header className="shrink-0 border-b border-line bg-ink pt-safe">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <Logo src={settings.logoUrl} name={settings.barName} variant="compact" />

          <form action={logoutPanel}>
            <button
              type="submit"
              className="flex h-11 items-center gap-2 border border-line px-3 text-sm text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
            >
              <LogOut className="size-4" aria-hidden />
              Salir
            </button>
          </form>
        </div>

        <nav
          aria-label="Otras pantallas"
          className="mx-auto flex max-w-2xl gap-2 px-4 pb-3"
        >
          <HeaderLink href="/staff/cocina" icon={Utensils} label="Cocina" />
          <HeaderLink href="/staff/barra" icon={Wine} label="Barra" />
          <HeaderLink href="/staff" icon={Star} label="Tarjetas" />
        </nav>
      </header>

      <main className="mx-auto w-full min-h-0 max-w-2xl flex-1 overflow-y-auto overscroll-contain px-4 py-6 pb-safe">
        <h1 className="font-display text-2xl text-bone">Mesas</h1>
        <p className="mt-2 text-sm text-muted">
          Toca una mesa roja para ver su cuenta. Toca una gris para abrirla.
        </p>

        <div className="mt-6">
          <TableGrid tables={tables} />
        </div>
      </main>
    </>
  );
}

/** Acceso de la cabecera: icono para encontrarlo, palabra para entenderlo. */
function HeaderLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-11 flex-1 items-center justify-center gap-2 border border-line px-2 text-sm text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
