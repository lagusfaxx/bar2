import type { ReactNode } from "react";

import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  action?: ReactNode;
  className?: string;
};

/**
 * Encabezado de seccion del sitio: etiqueta en versalitas, titulo en la serif
 * de display y una linea roja corta que ancla la composicion.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  action,
  className,
}: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        centered
          ? "items-center text-center"
          : "md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <Reveal className={cn("max-w-2xl", centered && "flex flex-col items-center")}>
        {eyebrow && (
          <div
            className={cn(
              "mb-4 flex items-center gap-3",
              centered && "justify-center",
            )}
          >
            <span className="h-px w-8 bg-crimson" />
            <span className="eyebrow text-crimson-bright">{eyebrow}</span>
          </div>
        )}

        <h2 className="text-[clamp(1.9rem,5vw,3.25rem)] leading-[1.05]">
          {title}
        </h2>

        {lead && (
          <p className="mt-5 text-[0.975rem] leading-relaxed text-muted sm:text-base">
            {lead}
          </p>
        )}
      </Reveal>

      {action && (
        <Reveal delay={120} className={cn("shrink-0", centered && "mt-2")}>
          {action}
        </Reveal>
      )}
    </div>
  );
}

/** Contenedor de seccion con el espaciado vertical estandar del sitio. */
export function Section({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn("py-20 sm:py-24 lg:py-32", className)}
      // Compensa la altura de la barra fija al saltar con anclas.
      style={id ? { scrollMarginTop: "5rem" } : undefined}
    >
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "crimson" | "gilt" | "muted" | "free";
  className?: string;
}) {
  const tones = {
    default: "border-bone/20 text-bone-dim",
    crimson: "border-crimson/50 bg-crimson/12 text-crimson-bright",
    gilt: "border-gilt/45 bg-gilt/10 text-gilt-soft",
    muted: "border-line text-muted",
    free: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 text-[0.6rem] font-medium uppercase tracking-[0.18em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
