import {
  CalendarDays,
  Images,
  Mail,
  MessageSquareQuote,
  Plus,
  Ticket,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";

import { listAudit } from "@/app/actions/admin/audit";
import { AdminHeader, EmptyState, Panel, StatCard } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/section";
import { prisma } from "@/lib/prisma";
import { dateParts, EVENT_CATEGORY_LABELS, formatDateTime } from "@/lib/format";

/**
 * Atajos con lenguaje llano. El panel lo usa gente que no trabaja con webs:
 * cada tarjeta dice que se consigue, no como se llama la seccion.
 *
 * Estan numeradas y ordenadas por lo que mas se hace en la semana. Antes esta
 * misma lista convivia con un panel de "Accesos rapidos" que llevaba a los
 * mismos cuatro sitios con otro nombre y otro icono: quien no conoce el panel
 * no ve dos atajos comodos, ve dos menus distintos y no sabe cual es el bueno.
 */
const TAREAS = [
  {
    href: "/admin/eventos/nuevo",
    title: "Publicar un show",
    text: "El título, la fecha, el afiche y el precio. Aparece en la web cuando lo marcas como publicado.",
  },
  {
    href: "/admin/carta",
    title: "Cambiar precios o platos",
    text: "Si algo se acabó, se oculta con un clic y vuelve cuando quieras. No hace falta borrarlo.",
  },
  {
    href: "/admin/galeria",
    title: "Subir las fotos de la noche",
    text: "Arrástralas y listo. Se achican solas para que la web siga cargando rápido en los teléfonos.",
  },
  {
    href: "/admin/ajustes",
    title: "Cambiar la portada, la dirección o los horarios",
    text: "Todo lo que dice la web sobre el bar: textos del inicio, teléfono, dirección, redes y horarios.",
  },
  {
    href: "/admin/tarjetas",
    title: "Confirmar el pago de una BarzuCard",
    text: "Cuando alguien transfiere, aquí marcas que llegó la plata y que le entregaste la tarjeta.",
  },
  {
    href: "/admin/promociones",
    title: "Crear una promoción",
    text: "2x1, descuentos o cortesías, con los días en que valen y cuántas veces puede usarla cada socio.",
  },
];

export default async function AdminDashboard() {
  const now = new Date();

  const [
    upcomingCount,
    publishedCount,
    draftCount,
    productCount,
    categoryCount,
    galleryCount,
    promotionCount,
    memberCount,
    redemptionCount,
    pendingRatings,
    unreadMessages,
    nextEvents,
    audit,
  ] = await Promise.all([
    prisma.event.count({ where: { published: true, startsAt: { gte: now } } }),
    prisma.event.count({ where: { published: true } }),
    prisma.event.count({ where: { published: false } }),
    prisma.menuProduct.count(),
    prisma.menuCategory.count(),
    prisma.galleryImage.count(),
    prisma.promotion.count({ where: { active: true } }),
    prisma.member.count(),
    prisma.redemption.count(),
    prisma.eventRating.count({ where: { approved: false } }),
    prisma.contactMessage.count({ where: { read: false, archived: false } }),
    prisma.event.findMany({
      where: { startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 6,
      select: {
        id: true,
        title: true,
        artist: true,
        slug: true,
        startsAt: true,
        category: true,
        published: true,
        featured: true,
      },
    }),
    listAudit(8),
  ]);

  return (
    <>
      <AdminHeader
        title="Panel de BARZUO"
        description="Desde aquí se cambia todo lo que ve el público en la web. Lo que guardes se ve al instante: no hay que avisarle a nadie ni publicar aparte."
        action={
          <ButtonLink href="/admin/eventos/nuevo" size="sm">
            <Plus className="size-4" aria-hidden />
            Publicar un show
          </ButtonLink>
        }
      />

      {/* Guia breve, pensada para quien entra al panel por primera vez y no
          tiene por que saber que hace cada seccion. Va arriba de todo a
          proposito: es lo que la mayoria viene a hacer. */}
      <Panel
        title="¿Qué quieres hacer?"
        description="Toca la tarea y te lleva directo al lugar donde se hace."
        className="mb-6"
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {TAREAS.map((tarea) => (
            <li key={tarea.href}>
              <Link
                href={tarea.href}
                className="flex h-full flex-col gap-1 border border-line bg-ink px-4 py-4 transition-colors hover:border-crimson"
              >
                <span className="text-base text-bone">{tarea.title}</span>
                <span className="text-xs leading-relaxed text-muted">
                  {tarea.text}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Shows por venir"
          value={upcomingCount}
          hint={`${publishedCount} se ven en la web · ${draftCount} sin publicar`}
          href="/admin/eventos"
          icon={<CalendarDays className="size-4" aria-hidden />}
          tone="crimson"
        />
        <StatCard
          label="Productos en la carta"
          value={productCount}
          hint={`repartidos en ${categoryCount} categorías`}
          href="/admin/carta"
          icon={<UtensilsCrossed className="size-4" aria-hidden />}
        />
        <StatCard
          label="Fotos en galería"
          value={galleryCount}
          href="/admin/galeria"
          icon={<Images className="size-4" aria-hidden />}
        />
        <StatCard
          label="Socios con BarzuCard"
          value={memberCount}
          hint={`usaron ${redemptionCount} promociones · ${promotionCount} activas`}
          href="/admin/tarjetas"
          icon={<Ticket className="size-4" aria-hidden />}
          tone="gilt"
        />
      </div>

      {/* Pendientes de atención */}
      {(pendingRatings > 0 || unreadMessages > 0) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {pendingRatings > 0 && (
            <StatCard
              label="Opiniones esperando tu visto bueno"
              value={pendingRatings}
              hint="Nadie las ve en la web hasta que las apruebes"
              href="/admin/resenas"
              icon={<MessageSquareQuote className="size-4" aria-hidden />}
              tone="crimson"
            />
          )}
          {unreadMessages > 0 && (
            <StatCard
              label="Mensajes de clientes sin leer"
              value={unreadMessages}
              href="/admin/mensajes"
              icon={<Mail className="size-4" aria-hidden />}
              tone="crimson"
            />
          )}
        </div>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Los próximos shows"
          description="Toca uno para editarlo. Los que dicen «Borrador» todavía no se ven en la web."
          action={
            <ButtonLink href="/admin/eventos" size="sm" variant="ghost">
              Ver todos
            </ButtonLink>
          }
        >
          {nextEvents.length === 0 ? (
            <EmptyState
              title="No hay eventos programados"
              description="Publica el primero y aparecerá en la web enseguida."
              action={
                <ButtonLink href="/admin/eventos/nuevo" size="sm">
                  <Plus className="size-4" aria-hidden />
                  Crear evento
                </ButtonLink>
              }
            />
          ) : (
            <ul className="flex flex-col">
              {nextEvents.map((event) => {
                const parts = dateParts(event.startsAt);

                return (
                  <li key={event.id}>
                    <Link
                      href={`/admin/eventos/${event.id}`}
                      className="group flex items-center gap-4 border-b border-line/60 py-3 last:border-0"
                    >
                      <span className="flex w-12 shrink-0 flex-col items-center border-r border-line pr-3 text-center">
                        <span className="font-display text-lg leading-none text-bone">
                          {parts.day}
                        </span>
                        <span className="mt-1 text-[0.55rem] tracking-[0.14em] text-crimson-bright">
                          {parts.month}
                        </span>
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-bone transition-colors group-hover:text-crimson-bright">
                          {event.title}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {parts.time} h ·{" "}
                          {event.artist ?? EVENT_CATEGORY_LABELS[event.category]}
                        </span>
                      </span>

                      <span className="flex shrink-0 gap-2">
                        {event.featured && <Badge tone="gilt">Destacado</Badge>}
                        <Badge tone={event.published ? "free" : "muted"}>
                          {event.published ? "Publicado" : "Borrador"}
                        </Badge>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/*
          "Actividad reciente" sonaba a registro tecnico y nadie lo miraba.
          Sirve para una sola cosa muy concreta, que es la que ahora dice el
          titulo: enterarse de que toco otra persona del equipo, y poder
          preguntarle. Se queda solo, sin el panel de "Accesos rapidos" que
          repetia por tercera vez los mismos enlaces.
        */}
        <Panel
          title="Últimos cambios del equipo"
          description="Quién cambió qué y cuándo, por si algo apareció distinto."
        >
          {audit.length === 0 ? (
            <p className="text-sm text-muted">
              Todavía nadie ha cambiado nada.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {audit.map((entry) => (
                <li key={entry.id} className="text-xs">
                  <p className="text-bone-dim">
                    {entry.summary ?? `${entry.action} · ${entry.entity}`}
                  </p>
                  <p className="text-muted-dark">
                    {entry.user?.name ?? "Sistema"} ·{" "}
                    {formatDateTime(entry.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

