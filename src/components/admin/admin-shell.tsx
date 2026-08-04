"use client";

import {
  Banknote,
  CalendarDays,
  ExternalLink,
  Gift,
  Images,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquareQuote,
  Settings,
  Star,
  Table2,
  Ticket,
  UtensilsCrossed,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { logoutPanel } from "@/app/actions/auth";
import { Logo } from "@/components/brand/logo";
import type { PanelSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** Para que sirve la seccion, en una linea. */
  hint?: string;
};

/**
 * Secciones del panel.
 *
 * Los titulos de grupo dicen que se logra ahi, no como se llama el modulo:
 * "Contenido" y "Comunidad" son categorias de quien programo el panel, no de
 * quien lo abre para subir las fotos del sabado. Cada seccion lleva ademas una
 * linea de ayuda que se muestra al pasar el mouse y, en el tablero, escrita.
 */
const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Lo que ve el público",
    items: [
      { href: "/admin", label: "Inicio del panel", icon: LayoutDashboard },
      {
        href: "/admin/eventos",
        label: "Shows y eventos",
        icon: CalendarDays,
        hint: "Publicar la cartelera del mes",
      },
      {
        href: "/admin/carta",
        label: "Carta y precios",
        icon: UtensilsCrossed,
        hint: "Platos, tragos y sus precios",
      },
      {
        href: "/admin/galeria",
        label: "Fotos del local",
        icon: Images,
        hint: "Las fotos que salen en la galería",
      },
      {
        href: "/admin/ajustes",
        label: "Datos del bar y portada",
        icon: Settings,
        hint: "Dirección, horarios, redes y textos del inicio",
      },
    ],
  },
  {
    title: "El día a día del local",
    items: [
      {
        href: "/admin/mesas",
        label: "Mesas del salón",
        icon: Table2,
        hint: "Crear y ordenar las mesas que usa la app de sala",
      },
      {
        href: "/admin/caja",
        label: "Ventas del día",
        icon: Banknote,
        hint: "Cuánto se vendió y cómo pagaron",
      },
      {
        href: "/admin/mensajes",
        label: "Mensajes de clientes",
        icon: Mail,
        hint: "Consultas y reservas del formulario de contacto",
      },
      {
        href: "/admin/resenas",
        label: "Opiniones por aprobar",
        icon: MessageSquareQuote,
        hint: "Se publican recién cuando las apruebas",
      },
    ],
  },
  {
    title: "Tarjeta de beneficios",
    items: [
      {
        href: "/admin/promociones",
        label: "Promociones",
        icon: Gift,
        hint: "2x1, descuentos y cortesías",
      },
      {
        href: "/admin/tarjetas",
        label: "Socios y sus tarjetas",
        icon: Ticket,
        hint: "Confirmar pagos y entregar tarjetas",
      },
      {
        href: "/admin/canjes",
        label: "Promociones usadas",
        icon: Star,
        hint: "Quién usó qué beneficio y cuándo",
      },
    ],
  },
  {
    title: "Quién entra al panel",
    items: [
      {
        href: "/admin/usuarios",
        label: "Usuarios del panel",
        icon: Users,
        adminOnly: true,
        hint: "Dar y quitar acceso al equipo",
      },
    ],
  },
];

export function AdminShell({
  session,
  barName,
  logoUrl,
  children,
}: {
  session: PanelSession;
  barName: string;
  logoUrl: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // El cajon se recuerda junto a la ruta en la que se abrio: al navegar, el
  // pathname cambia y queda cerrado sin necesidad de un efecto.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const setOpen = (value: boolean) => setOpenedAt(value ? pathname : null);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-5">
        <Link href="/admin" aria-label="Panel de BARZUO">
          <Logo src={logoUrl} name={barName} variant="compact" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
          className="flex size-9 items-center justify-center border border-line text-bone-dim lg:hidden"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <nav aria-label="Secciones del panel" className="flex-1 overflow-y-auto px-3 py-5">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(
            (item) => !item.adminOnly || session.role === "ADMIN",
          );

          if (items.length === 0) return null;

          return (
            <div key={group.title} className="mb-6">
              <p className="mb-2 px-3 text-[0.58rem] font-semibold tracking-[0.22em] text-muted-dark uppercase">
                {group.title}
              </p>
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.hint}
                      aria-current={isActive(item.href) ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors duration-200",
                        isActive(item.href)
                          ? "bg-crimson/15 text-bone"
                          : "text-muted hover:bg-bone/5 hover:text-bone",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "size-4 shrink-0",
                          isActive(item.href) && "text-crimson-bright",
                        )}
                        aria-hidden
                      />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-line p-4">
        <Link
          href="/"
          target="_blank"
          className="mb-3 flex items-center gap-2.5 px-3 py-2 text-xs text-muted transition-colors hover:text-bone"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Ver el sitio público
        </Link>

        <div className="flex items-center justify-between gap-3 px-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-bone">{session.name}</p>
            <p className="truncate text-[0.65rem] tracking-[0.12em] text-muted-dark uppercase">
              {session.role === "ADMIN" ? "Administrador" : "Editor"}
            </p>
          </div>

          <form action={logoutPanel}>
            <button
              type="submit"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="flex size-9 items-center justify-center border border-line text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[100svh] bg-ink">
      {/* Barra lateral fija en escritorio */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-ink-soft lg:block">
        <div className="sticky top-0 h-[100svh]">{sidebar}</div>
      </aside>

      {/* Cajón lateral en móvil */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/80 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 border-r border-line bg-ink-soft lg:hidden">
            {sidebar}
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-line bg-ink/92 px-4 py-3 backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            className="flex size-10 items-center justify-center border border-line text-bone"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <Logo src={logoUrl} name={barName} variant="compact" />
        </header>

        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
