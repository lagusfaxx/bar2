import { ArrowUpRight, Clock, Ticket } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/section";
import type { EventCard as EventCardData } from "@/lib/content";
import { dateParts, EVENT_CATEGORY_LABELS, formatPrice, relativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

type EventCardProps = {
  event: EventCardData;
  /** "poster" en grillas, "wide" para listados horizontales. */
  layout?: "poster" | "wide";
  priority?: boolean;
  className?: string;
};

/** Bloque de fecha del afiche: dia grande sobre mes en versalitas. */
function DateBlock({ date, className }: { date: Date; className?: string }) {
  const parts = dateParts(date);

  return (
    <div
      className={cn(
        "flex flex-col items-center border border-bone/15 bg-ink/85 px-3 py-2 text-center sm:bg-ink/80 sm:backdrop-blur-md",
        className,
      )}
    >
      <span className="font-display text-2xl leading-none text-bone">
        {parts.day}
      </span>
      <span className="mt-1 text-[0.55rem] font-semibold tracking-[0.2em] text-crimson-bright">
        {parts.month}
      </span>
    </div>
  );
}

export function EventCard({
  event,
  layout = "poster",
  priority = false,
  className,
}: EventCardProps) {
  const parts = dateParts(event.startsAt);
  const soon = relativeDay(event.startsAt);
  const image = event.posterUrl ?? event.coverUrl;

  if (layout === "wide") {
    return (
      <Link
        href={`/eventos/${event.slug}`}
        className={cn(
          "card-bz hover-ember group grid grid-cols-[7.5rem_1fr] items-stretch gap-0 sm:grid-cols-[12rem_1fr]",
          className,
        )}
      >
        <div className="relative overflow-hidden bg-surface-2">
          {image ? (
            <Image
              src={image}
              alt=""
              fill
              sizes="(max-width: 640px) 120px, 192px"
              className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-crimson-deep/40 to-ink" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-ink/70" />
        </div>

        <div className="flex flex-col justify-between gap-4 p-5 sm:p-6">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="crimson">
                {EVENT_CATEGORY_LABELS[event.category] ?? event.category}
              </Badge>
              {soon && <Badge tone="gilt">{soon}</Badge>}
            </div>

            <h3 className="font-display text-xl leading-tight text-bone transition-colors group-hover:text-crimson-bright sm:text-2xl">
              {event.title}
            </h3>

            {event.artist && (
              <p className="mt-1 text-sm text-muted">{event.artist}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
            <span className="capitalize text-bone-dim">
              {parts.weekday} {parts.day} {parts.monthLong}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden />
              {parts.time}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Ticket className="size-3.5" aria-hidden />
              {event.isFree ? "Entrada libre" : formatPrice(event.priceCents)}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/eventos/${event.slug}`}
      className={cn(
        "card-bz hover-ember group flex flex-col",
        "hover:-translate-y-1",
        className,
      )}
    >
      <div className="relative aspect-[5/7] overflow-hidden bg-surface-2">
        {image ? (
          <Image
            src={image}
            alt={`Afiche de ${event.title}`}
            fill
            // Inmediata pero sin precarga: el primer afiche esta arriba, pero
            // por debajo de la portada. Precargarlo le robaria prioridad a la
            // imagen que ocupa la pantalla entera.
            loading={priority ? "eager" : "lazy"}
            sizes="(max-width: 640px) 88vw, (max-width: 1024px) 45vw, 30vw"
            className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
          />
        ) : (
          // Sin afiche cargado, la tarjeta sigue siendo una pieza compuesta.
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(120%_80%_at_50%_0%,var(--color-crimson-deep),var(--color-ink))]">
            <span className="font-western text-4xl text-crimson/40">BZ</span>
          </div>
        )}

        <div className="scrim absolute inset-0" />

        <DateBlock date={event.startsAt} className="absolute top-4 left-4 z-10" />

        <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
          {event.featured && <Badge tone="gilt">Destacado</Badge>}
          {soon && <Badge tone="crimson">{soon}</Badge>}
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 p-5">
          <p className="eyebrow mb-2 text-crimson-bright">
            {EVENT_CATEGORY_LABELS[event.category] ?? event.category}
          </p>

          <h3 className="font-display text-[1.35rem] leading-[1.15] text-bone">
            {event.title}
          </h3>

          {event.artist && (
            <p className="mt-1.5 text-sm text-bone-dim">{event.artist}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted capitalize">
            {parts.weekday} · {parts.time} h
          </span>
          <span
            className={cn(
              "text-sm font-medium",
              event.isFree ? "text-emerald-300" : "text-bone",
            )}
          >
            {event.isFree ? "Entrada libre" : formatPrice(event.priceCents)}
          </span>
        </div>

        <span
          aria-hidden
          className="flex size-9 items-center justify-center border border-line text-muted transition-all duration-500 group-hover:border-crimson group-hover:bg-crimson group-hover:text-bone"
        >
          <ArrowUpRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}
