import { Eye, EyeOff, Pencil, Plus, Star, StarOff } from "lucide-react";
import Link from "next/link";

import {
  toggleEventFeatured,
  toggleEventPublished,
} from "@/app/actions/admin/events";
import { ActionButton } from "@/components/admin/action-button";
import {
  AdminHeader,
  EmptyState,
  Panel,
  Table,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/section";
import { EVENT_CATEGORY_LABELS, formatPrice, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Cartelera" };

type Filter = "proximos" | "pasados" | "borradores" | "todos";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "proximos", label: "Próximos" },
  { value: "pasados", label: "Pasados" },
  { value: "borradores", label: "Borradores" },
  { value: "todos", label: "Todos" },
];

export default async function AdminEventosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro } = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.value === filtro)
    ? (filtro as Filter)
    : "proximos";

  const now = new Date();

  const where =
    filter === "proximos"
      ? { startsAt: { gte: now } }
      : filter === "pasados"
        ? { startsAt: { lt: now } }
        : filter === "borradores"
          ? { published: false }
          : {};

  const events = await prisma.event.findMany({
    where,
    orderBy: { startsAt: filter === "pasados" ? "desc" : "asc" },
    take: 120,
    select: {
      id: true,
      slug: true,
      title: true,
      artist: true,
      category: true,
      startsAt: true,
      isFree: true,
      priceCents: true,
      published: true,
      featured: true,
      _count: { select: { ratings: true } },
    },
  });

  return (
    <>
      <AdminHeader
        title="Cartelera"
        description="Creá, editá y publicá los eventos que se muestran en la web."
        action={
          <ButtonLink href="/admin/eventos/nuevo" size="sm">
            <Plus className="size-4" aria-hidden />
            Nuevo evento
          </ButtonLink>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <Link
            key={option.value}
            href={`/admin/eventos?filtro=${option.value}`}
            aria-current={filter === option.value ? "true" : undefined}
            className={
              filter === option.value
                ? "border border-crimson bg-crimson px-4 py-2 text-[0.65rem] font-medium tracking-[0.16em] text-bone uppercase"
                : "border border-line px-4 py-2 text-[0.65rem] font-medium tracking-[0.16em] text-muted uppercase transition-colors hover:border-bone/30 hover:text-bone"
            }
          >
            {option.label}
          </Link>
        ))}
      </div>

      <Panel>
        {events.length === 0 ? (
          <EmptyState
            title="No hay eventos en esta vista"
            description="Probá con otro filtro o creá un evento nuevo."
            action={
              <ButtonLink href="/admin/eventos/nuevo" size="sm">
                <Plus className="size-4" aria-hidden />
                Crear evento
              </ButtonLink>
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Evento</Th>
                  <Th className="hidden md:table-cell">Fecha</Th>
                  <Th className="hidden lg:table-cell">Categoría</Th>
                  <Th className="hidden lg:table-cell">Entrada</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="group">
                    <Td>
                      <Link
                        href={`/admin/eventos/${event.id}`}
                        className="block max-w-xs"
                      >
                        <span className="block truncate text-sm text-bone transition-colors group-hover:text-crimson-bright">
                          {event.title}
                        </span>
                        {event.artist && (
                          <span className="block truncate text-xs text-muted">
                            {event.artist}
                          </span>
                        )}
                        <span className="mt-0.5 block text-xs text-muted-dark md:hidden">
                          {formatDateTime(event.startsAt)}
                        </span>
                      </Link>
                    </Td>

                    <Td className="hidden whitespace-nowrap text-xs text-muted md:table-cell">
                      {formatDateTime(event.startsAt)}
                    </Td>

                    <Td className="hidden lg:table-cell">
                      <Badge tone="muted">
                        {EVENT_CATEGORY_LABELS[event.category]}
                      </Badge>
                    </Td>

                    <Td className="hidden whitespace-nowrap text-xs lg:table-cell">
                      {event.isFree ? (
                        <span className="text-emerald-300">Libre</span>
                      ) : (
                        <span className="text-bone-dim">
                          {formatPrice(event.priceCents)}
                        </span>
                      )}
                    </Td>

                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={event.published ? "free" : "muted"}>
                          {event.published ? "Publicado" : "Borrador"}
                        </Badge>
                        {event.featured && <Badge tone="gilt">Destacado</Badge>}
                      </div>
                    </Td>

                    <Td>
                      <div className="flex items-center justify-end gap-1.5">
                        <ActionButton
                          action={async () => {
                            "use server";
                            await toggleEventPublished(event.id, !event.published);
                          }}
                          title={event.published ? "Despublicar" : "Publicar"}
                          aria-label={event.published ? "Despublicar" : "Publicar"}
                        >
                          {event.published ? (
                            <EyeOff className="size-4" aria-hidden />
                          ) : (
                            <Eye className="size-4" aria-hidden />
                          )}
                        </ActionButton>

                        <ActionButton
                          action={async () => {
                            "use server";
                            await toggleEventFeatured(event.id, !event.featured);
                          }}
                          title={event.featured ? "Quitar de destacados" : "Destacar"}
                          aria-label={
                            event.featured ? "Quitar de destacados" : "Destacar"
                          }
                        >
                          {event.featured ? (
                            <StarOff className="size-4" aria-hidden />
                          ) : (
                            <Star className="size-4" aria-hidden />
                          )}
                        </ActionButton>

                        <Link
                          href={`/admin/eventos/${event.id}`}
                          title="Editar"
                          aria-label={`Editar ${event.title}`}
                          className="inline-flex size-9 items-center justify-center border border-line text-muted transition-colors hover:border-crimson hover:text-crimson-bright"
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Link>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
