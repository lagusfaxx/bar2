import { Check, Trash2, X } from "lucide-react";
import Link from "next/link";

import { deleteRating, setRatingApproval } from "@/app/actions/admin/content";
import { ActionButton } from "@/components/admin/action-button";
import { AdminHeader, EmptyState, Panel } from "@/components/admin/ui";
import { Stars } from "@/components/events/stars";
import { Badge } from "@/components/ui/section";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Reseñas" };

export default async function AdminResenasPage() {
  const ratings = await prisma.eventRating.findMany({
    orderBy: [{ approved: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { event: { select: { title: true, slug: true } } },
  });

  const pending = ratings.filter((rating) => !rating.approved);
  const approved = ratings.filter((rating) => rating.approved);

  return (
    <>
      <AdminHeader
        title="Opiniones por aprobar"
        description="Lo que el público escribió sobre los shows. No se ve en la web hasta que tú la apruebes."
      />

      <div className="flex flex-col gap-6">
        <Panel
          title={`Pendientes de revisión (${pending.length})`}
          description="Nadie las ve en la web hasta que las aprobes."
        >
          {pending.length === 0 ? (
            <p className="text-sm text-muted">No hay reseñas pendientes.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {pending.map((rating) => (
                <RatingRow key={rating.id} rating={rating} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={`Publicadas (${approved.length})`}>
          {approved.length === 0 ? (
            <EmptyState
              title="Todavía no publicaste ninguna reseña"
              description="Aprueba las pendientes para que aparezcan en la ficha del evento."
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {approved.map((rating) => (
                <RatingRow key={rating.id} rating={rating} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

type RatingWithEvent = Awaited<
  ReturnType<typeof prisma.eventRating.findMany<{ include: { event: { select: { title: true; slug: true } } } }>>
>[number];

function RatingRow({ rating }: { rating: RatingWithEvent }) {
  return (
    <li className="flex flex-col gap-3 border border-line bg-ink p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-bone">{rating.authorName}</p>
          <Stars value={rating.rating} size="sm" />
          <Badge tone={rating.approved ? "free" : "muted"}>
            {rating.approved ? "Publicada" : "Pendiente"}
          </Badge>
        </div>

        <Link
          href={`/eventos/${rating.event.slug}`}
          target="_blank"
          className="mt-1 block text-xs text-crimson-bright hover:underline"
        >
          {rating.event.title}
        </Link>

        {rating.comment && (
          <p className="mt-2 text-sm leading-relaxed text-muted">{rating.comment}</p>
        )}

        <p className="mt-2 text-xs text-muted-dark">
          {formatDateTime(rating.createdAt)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <ActionButton
          action={async () => {
            "use server";
            await setRatingApproval(rating.id, !rating.approved);
          }}
          title={rating.approved ? "Despublicar" : "Aprobar"}
          aria-label={rating.approved ? "Despublicar reseña" : "Aprobar reseña"}
        >
          {rating.approved ? (
            <X className="size-4" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
        </ActionButton>

        <ActionButton
          variant="danger"
          confirm="¿Eliminar esta reseña definitivamente?"
          action={async () => {
            "use server";
            await deleteRating(rating.id);
          }}
          title="Eliminar"
          aria-label="Eliminar reseña"
        >
          <Trash2 className="size-4" aria-hidden />
        </ActionButton>
      </div>
    </li>
  );
}
