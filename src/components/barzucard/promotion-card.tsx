import { CalendarClock, Star } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/section";
import {
  formatDate,
  promotionValueLabel,
  TIER_LABELS,
  WEEKDAY_LABELS,
} from "@/lib/format";
import { cn } from "@/lib/utils";

type Promotion = {
  id: string;
  title: string;
  description: string;
  terms: string | null;
  imageUrl: string | null;
  type: string;
  value: number;
  endsAt: Date | null;
  minTier: string;
  maxPerCard: number;
  pointsCost: number;
  availableWeekdays: number[];
};

export function PromotionCard({
  promotion,
  className,
}: {
  promotion: Promotion;
  className?: string;
}) {
  const days =
    promotion.availableWeekdays.length > 0
      ? promotion.availableWeekdays
          .map((day) => WEEKDAY_LABELS[day]?.slice(0, 3))
          .join(" · ")
      : null;

  return (
    <article className={cn("card-bz hover-ember flex h-full flex-col", className)}>
      <div className="relative aspect-3/2 overflow-hidden bg-surface-2">
        {promotion.imageUrl ? (
          <Image
            src={promotion.imageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 88vw, (max-width: 1024px) 45vw, 30vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-crimson-deep/40 to-ink" />
        )}

        <div className="scrim absolute inset-0" />

        <p className="absolute bottom-4 left-4 font-display text-2xl text-bone">
          {promotionValueLabel(promotion.type, promotion.value)}
        </p>

        {promotion.minTier !== "CLASICA" && (
          <Badge tone="gilt" className="absolute top-4 right-4">
            Solo {TIER_LABELS[promotion.minTier]}
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="font-display text-lg leading-tight text-bone">
          {promotion.title}
        </h3>

        <p className="text-sm leading-relaxed text-muted">
          {promotion.description}
        </p>

        <ul className="mt-auto flex flex-col gap-1.5 border-t border-line pt-4 text-xs text-muted-dark">
          <li>
            {promotion.maxPerCard === 0
              ? "Sin límite de usos"
              : promotion.maxPerCard === 1
                ? "Un uso por tarjeta"
                : `Hasta ${promotion.maxPerCard} usos por tarjeta`}
          </li>

          {days && <li>Válido: {days}</li>}

          {promotion.pointsCost > 0 && (
            <li className="flex items-center gap-1.5 text-gilt-soft">
              <Star className="size-3" aria-hidden />
              Cuesta {promotion.pointsCost} puntos
            </li>
          )}

          {promotion.endsAt && (
            <li className="flex items-center gap-1.5">
              <CalendarClock className="size-3" aria-hidden />
              Hasta el {formatDate(promotion.endsAt, { month: "short" })}
            </li>
          )}
        </ul>
      </div>
    </article>
  );
}
