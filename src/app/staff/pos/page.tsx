import { LogOut, Mic, Star, Utensils, Wine, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutPanel } from "@/app/actions/auth";
import { Logo } from "@/components/brand/logo";
import { TableGrid } from "@/components/staff/pos/table-grid";
import { getPanelSession } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { getTablesOverview } from "@/lib/pos";
import { posVersion } from "@/lib/pos-version";

/** Sala: el estado de las mesas cambia cada minuto, nunca se cachea. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sala",
};

export default async function PosPage() {
  const session = await getPanelSession();

  if (!session) redirect("/staff/login?volver=/staff/pos");

  const [settings, tables, version] = await Promise.all([
    getSettings(),
    getTablesOverview(),
    // Marca del estado de la sala: la pantalla la usa para preguntar si algo
    // cambio antes de volver a pedirla entera (ver lib/pos-version.ts).
    posVersion({ kind: "sala" }),
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
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3 lg:max-w-none">
          <Logo src={settings.logoUrl} name={settings.barName} variant="compact" />

          {/* En la pantalla tactil del local caben en la misma fila; en un
              telefono no, y bajan a la suya. */}
          <nav aria-label="Otras pantallas" className="hidden gap-2 lg:flex">
            <HeaderLink href="/staff/cocina" icon={Utensils} label="Cocina" />
            <HeaderLink href="/staff/barra" icon={Wine} label="Barra" />
            <HeaderLink href="/staff/karaoke" icon={Mic} label="Karaoke" />
            <HeaderLink href="/staff" icon={Star} label="Tarjetas" />
          </nav>

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
          className="mx-auto flex max-w-2xl gap-2 px-4 pb-3 lg:hidden"
        >
          <HeaderLink href="/staff/cocina" icon={Utensils} label="Cocina" />
          <HeaderLink href="/staff/barra" icon={Wine} label="Barra" />
          <HeaderLink href="/staff/karaoke" icon={Mic} label="Karaoke" />
          <HeaderLink href="/staff" icon={Star} label="Tarjetas" />
        </nav>
      </header>

      {/*
        El ancho depende de la pantalla.

        La app nacio para el telefono del garzon y por eso todo vivia en una
        columna de 42rem centrada. En la pantalla tactil del local —apaisada y
        de 1024 puntos o mas— esa misma columna deja media pantalla negra y
        obliga a desplazar para ver las mesas del fondo, que es justo lo que no
        se quiere en una pantalla fija: la sala tiene que verse entera de una.
      */}
      <main className="mx-auto w-full min-h-0 max-w-2xl flex-1 overflow-y-auto overscroll-contain px-4 py-6 pb-safe lg:max-w-none lg:px-6">
        <h1 className="font-display text-2xl text-bone">Mesas</h1>
        <p className="mt-2 text-sm text-muted">
          Toca una mesa roja para ver su cuenta. Toca una gris para abrirla.
        </p>

        <div className="mt-6">
          <TableGrid tables={tables} version={version} />
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
      {/* Cuatro accesos en la fila del telefono no dejan lugar para el icono y
          la palabra a la vez. Se cae el icono, que es el que menos dice: la
          palabra sola se entiende, el icono solo hay que adivinarlo. */}
      <Icon className="hidden size-4 shrink-0 min-[420px]:block" aria-hidden />
      {label}
    </Link>
  );
}
