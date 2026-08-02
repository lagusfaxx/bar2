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
  /** Nombre del local; el de fabrica es BARZUO. */
  barName?: string;
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
 *
 * Jerarquia: el QR y el nombre del socio son lo que se mira en la barra, asi
 * que llevan el tamano; el resto acompana. Se evitan los textos diminutos con
 * mucho espaciado entre letras, que a este tamano se vuelven ilegibles.
 */
export function CardVisual({
  cardNumber,
  holder,
  tier,
  points,
  qrDataUrl,
  issuedAt,
  status = "ACTIVE",
  barName = "BARZUO",
  className,
}: CardVisualProps) {
  const suspended = status !== "ACTIVE";

  return (
    <div
      className={cn(
        "print-card relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-lift sm:p-6",
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

      <div className="relative flex h-full items-stretch gap-4 sm:gap-5">
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div className="min-w-0">
            <p className="truncate font-western text-xl leading-none text-crimson sm:text-2xl">
              {barName}
            </p>
            <p
              className={cn(
                "mt-2 text-xs font-medium sm:text-sm",
                TIER_ACCENT[tier] ?? TIER_ACCENT.CLASICA,
              )}
            >
              BarzuCard {TIER_LABELS[tier] ?? tier}
            </p>
          </div>

          <div className="min-w-0">
            <p className="truncate text-base leading-tight font-medium text-bone sm:text-lg">
              {holder}
            </p>

            <p className="mt-1.5 truncate font-mono text-sm text-bone-dim sm:text-base">
              {formatCardNumber(cardNumber)}
            </p>

            <p className="mt-2 text-xs text-muted sm:text-sm">
              {points} {points === 1 ? "punto" : "puntos"}
              {issuedAt && (
                <>
                  {" · "}
                  socio desde{" "}
                  {new Intl.DateTimeFormat("es-CL", {
                    month: "2-digit",
                    year: "numeric",
                  }).format(issuedAt)}
                </>
              )}
            </p>
          </div>
        </div>

        {qrDataUrl && (
          <div className="flex shrink-0 items-center">
            {/* El QR va sobre blanco puro: es lo que garantiza que lo lea
                cualquier camara, incluso con la pantalla a media luz. */}
            <div className="rounded-lg bg-white p-2">
              <Image
                src={qrDataUrl}
                alt="Código QR de la BarzuCard"
                width={160}
                height={160}
                unoptimized
                className="size-20 sm:size-28"
              />
            </div>
          </div>
        )}
      </div>

      {suspended && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/70">
          <p className="border border-crimson px-4 py-2 text-sm text-crimson-bright">
            Tarjeta suspendida
          </p>
        </div>
      )}
    </div>
  );
}
