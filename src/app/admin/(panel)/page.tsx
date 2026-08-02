import {
  CalendarDays,
  Gift,
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
        description="Un vistazo general al contenido del sitio y a la actividad reciente."
        action={
          <ButtonLink href="/admin/eventos/nuevo" size="sm">
            <Plus className="size-4" aria-hidden />
            Nuevo evento
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Próximos eventos"
          value={upcomingCount}
          hint={`${publishedCount} publicados · ${draftCount} en borrador`}
          href="/admin/eventos"
          icon={<CalendarDays className="size-4" aria-hidden />}
          tone="crimson"
        />
        <StatCard
          label="Carta"
          value={productCount}
          hint={`${categoryCount} categorías`}
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
          label="Socios BarzuCard"
          value={memberCount}
          hint={`${redemptionCount} canjes realizados`}
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
              label="Reseñas por revisar"
              value={pendingRatings}
              hint="Se publican recién cuando las aprobás"
              href="/admin/resenas"
              icon={<MessageSquareQuote className="size-4" aria-hidden />}
              tone="crimson"
            />
          )}
          {unreadMessages > 0 && (
            <StatCard
              label="Mensajes sin leer"
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
          title="Próximas fechas"
          description="Los eventos más cercanos en el calendario."
          action={
            <ButtonLink href="/admin/eventos" size="sm" variant="ghost">
              Ver todos
            </ButtonLink>
          }
        >
          {nextEvents.length === 0 ? (
            <EmptyState
              title="No hay eventos programados"
              description="Cargá el primer show para que aparezca en la cartelera."
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

        <div className="flex flex-col gap-6">
          <Panel title="Accesos rápidos">
            <div className="grid grid-cols-2 gap-3">
              <QuickLink href="/admin/eventos/nuevo" icon={<CalendarDays className="size-4" aria-hidden />}>
                Nuevo evento
              </QuickLink>
              <QuickLink href="/admin/carta" icon={<UtensilsCrossed className="size-4" aria-hidden />}>
                Editar carta
              </QuickLink>
              <QuickLink href="/admin/galeria" icon={<Images className="size-4" aria-hidden />}>
                Subir fotos
              </QuickLink>
              <QuickLink href="/admin/promociones" icon={<Gift className="size-4" aria-hidden />}>
                Promociones
              </QuickLink>
            </div>

            <p className="mt-5 border-t border-line pt-4 text-xs text-muted-dark">
              {promotionCount} promociones activas en la BarzuCard.
            </p>
          </Panel>

          <Panel title="Actividad reciente">
            {audit.length === 0 ? (
              <p className="text-sm text-muted">Todavía no hay movimientos.</p>
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
      </div>
    </>
  );
}

function QuickLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 border border-line p-4 text-xs text-muted transition-colors hover:border-crimson/50 hover:text-bone"
    >
      <span className="text-crimson">{icon}</span>
      {children}
    </Link>
  );
}
