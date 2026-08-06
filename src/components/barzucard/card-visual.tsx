import Image from "next/image";

import { formatCardNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type CardVisualProps = {
  cardNumber: string;
  holder: string;
  /** Data URL del QR, generado en el servidor. */
  qrDataUrl?: string;
  issuedAt?: Date;
  status?: string;
  /** Nombre del local; el de fabrica es BARZUO. */
  barName?: string;
  className?: string;
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
        "print-card relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl border border-bone/15 bg-gradient-to-br from-surface-2 via-ink to-crimson-deep/40 p-5 shadow-lift sm:p-6",
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
            <p className="mt-2 text-xs font-medium text-crimson-bright sm:text-sm">
              BarzuCard
            </p>
          </div>

          <div className="min-w-0">
            <p className="truncate text-base leading-tight font-medium text-bone sm:text-lg">
              {holder}
            </p>

            <p className="mt-1.5 truncate font-mono text-sm text-bone-dim sm:text-base">
              {formatCardNumber(cardNumber)}
            </p>

            {issuedAt && (
              <p className="mt-2 text-xs text-muted sm:text-sm">
                Socio desde{" "}
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
