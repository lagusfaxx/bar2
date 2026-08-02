import { notFound } from "next/navigation";

import { EventForm } from "@/components/admin/event-form";
import { AdminHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/section";
import { toDateTimeLocal } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Editar evento" };

export default async function EditarEventoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
}) {
  const [{ id }, { creado }] = await Promise.all([params, searchParams]);

  const event = await prisma.event.findUnique({ where: { id } });

  if (!event) notFound();

  return (
    <>
      <AdminHeader
        title={event.title}
        description={
          creado
            ? "El evento se creó correctamente. Ya podés completar el resto de los datos."
            : "Editá los datos del evento y guardá los cambios."
        }
        back={{ href: "/admin/eventos", label: "Volver a la cartelera" }}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={event.published ? "free" : "muted"}>
              {event.published ? "Publicado" : "Borrador"}
            </Badge>
            {event.featured && <Badge tone="gilt">Destacado</Badge>}
          </div>
        }
      />

      <EventForm
        event={{
          id: event.id,
          slug: event.slug,
          title: event.title,
          artist: event.artist,
          category: event.category,
          excerpt: event.excerpt,
          description: event.description,
          posterUrl: event.posterUrl,
          coverUrl: event.coverUrl,
          startsAt: toDateTimeLocal(event.startsAt),
          doorsAt: toDateTimeLocal(event.doorsAt),
          endsAt: toDateTimeLocal(event.endsAt),
          isFree: event.isFree,
          price:
            event.priceCents != null
              ? (event.priceCents / 100).toString()
              : undefined,
          ticketUrl: event.ticketUrl,
          capacity: event.capacity,
          published: event.published,
          featured: event.featured,
          ratingLock: event.ratingLock,
          seoTitle: event.seoTitle,
          seoDescription: event.seoDescription,
          ogImageUrl: event.ogImageUrl,
        }}
      />
    </>
  );
}
