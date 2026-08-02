import Image from "next/image";

import { formatCardNumber, TIER_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

type CardVisualProps = {
  cardNumber: string;
  holder: string;
  tier: string;
  points: number;
  /** Data URL del QR, generado en el servidor. */
  qrDataUrl?: string;
  issuedAt?: Date;
  status?: string;
  className?: string;
};

const TIER_STYLES: Record<string, string> = {
  CLASICA: "from-surface-2 via-ink to-crimson-deep/40 border-bone/15",
  PLATA: "from-slate-500/25 via-ink to-slate-300/10 border-slate-300/30",
  ORO: "from-gilt/25 via-ink to-gilt/10 border-gilt/40",
};

const TIER_ACCENT: Record<string, string> = {
  CLASICA: "text-crimson-bright",
  PLATA: "text-slate-200",
  ORO: "text-gilt-soft",
};

/**
 * Representación visual de la BarzuCard.
 *
 * Se dibuja con HTML y no como imagen: se ve nítida en cualquier pantalla, se
 * adapta al ancho disponible y se puede imprimir tal cual (ver estilos de
 * impresión en globals.css).
 */
export function CardVisual({
  cardNumber,
  holder,
  tier,
  points,
  qrDataUrl,
  issuedAt,
  status = "ACTIVE",
  className,
}: CardVisualProps) {
  const suspended = status !== "ACTIVE";

  return (
    <div
      className={cn(
        "print-card relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-lift sm:p-7",
        TIER_STYLES[tier] ?? TIER_STYLES.CLASICA,
        suspended && "grayscale",
        className,
      )}
    >
      {/* Textura sutil, para que no se vea como un rectángulo plano. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(120% 90% at 85% 0%, rgba(225,29,42,0.35), transparent 60%)",
        }}
      />

      <div className="relative flex h-full gap-4">
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <p className="font-western text-lg leading-none text-crimson sm:text-2xl">
              BAR<span className="text-bone">Z</span>UO
            </p>
            <p
              className={cn(
                "mt-1.5 text-[0.55rem] font-medium tracking-[0.24em] uppercase sm:text-[0.62rem]",
                TIER_ACCENT[tier] ?? TIER_ACCENT.CLASICA,
              )}
            >
              BarzuCard · {TIER_LABELS[tier] ?? tier}
            </p>
          </div>

          <div className="min-w-0">
            <p className="truncate font-mono text-[0.72rem] tracking-[0.16em] text-bone sm:text-sm">
              {formatCardNumber(cardNumber)}
            </p>

            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.5rem] tracking-[0.2em] text-muted uppercase">
                  Socio
                </p>
                <p className="truncate text-xs text-bone-dim sm:text-sm">
                  {holder}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[0.5rem] tracking-[0.2em] text-muted uppercase">
                  Puntos
                </p>
                <p className="font-display text-base text-bone sm:text-lg">
                  {points}
                </p>
              </div>
            </div>

            {issuedAt && (
              <p className="mt-2 text-[0.5rem] tracking-[0.16em] text-muted-dark uppercase">
                Miembro desde{" "}
                {new Intl.DateTimeFormat("es-CL", {
                  month: "2-digit",
                  year: "numeric",
                }).format(issuedAt)}
              </p>
            )}
          </div>
        </div>

        {qrDataUrl && (
          <div className="flex shrink-0 items-center">
            <div className="rounded-lg bg-bone p-1.5 sm:p-2">
              <Image
                src={qrDataUrl}
                alt="Código QR de la BarzuCard"
                width={128}
                height={128}
                unoptimized
                className="size-16 sm:size-24"
              />
            </div>
          </div>
        )}
      </div>

      {suspended && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/70">
          <p className="border border-crimson px-4 py-2 text-xs tracking-[0.2em] text-crimson-bright uppercase">
            Tarjeta suspendida
          </p>
        </div>
      )}
    </div>
  );
}
