import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/** Muestra una puntuación de 0 a 5, con media estrella cuando corresponde. */
export function Stars({
  value,
  size = "md",
  className,
}: {
  value: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "size-3.5", md: "size-4", lg: "size-5" } as const;

  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${value.toFixed(1)} de 5 estrellas`}
    >
      {[1, 2, 3, 4, 5].map((position) => {
        // Proporción de la estrella que se rellena, para representar decimales.
        const fill = Math.max(0, Math.min(1, value - position + 1));

        return (
          <span key={position} className="relative inline-flex">
            <Star className={cn(sizes[size], "text-muted-dark")} aria-hidden />
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  className={cn(sizes[size], "fill-gilt text-gilt")}
                  aria-hidden
                />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
