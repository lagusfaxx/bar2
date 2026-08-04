import Image from "next/image";

import { cn } from "@/lib/utils";

type LogoProps = {
  /** Logotipo subido desde el CMS. Si existe, reemplaza al lockup tipografico. */
  src?: string | null;
  name?: string;
  tagline?: string | null;
  variant?: "full" | "compact" | "stacked";
  className?: string;
  priority?: boolean;
};

/**
 * Lockup de BARZUO: "BAR" y "UO" en carmesi con la "Z" en blanco hueso, tal
 * como en el logotipo original. Es tipografico a proposito — escala sin perder
 * nitidez y se adapta al color del contexto. El administrador puede subir el
 * logo definitivo desde Ajustes y este componente lo usa en su lugar.
 */
export function Logo({
  src,
  name = "BARZUO",
  tagline,
  variant = "full",
  className,
  priority = false,
}: LogoProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={320}
        height={120}
        // Carga inmediata, pero sin precarga en la cabecera. El logo de la
        // barra superior sale en todas las paginas y es una imagen chica; si
        // se precargara, competiria por el ancho de banda del telefono con la
        // foto de portada, que es la que el visitante esta esperando ver.
        loading={priority ? "eager" : "lazy"}
        className={cn("h-auto w-auto object-contain", className)}
      />
    );
  }

  // Partimos el nombre en la primera "Z" para destacarla, como en el logotipo.
  const upper = name.toUpperCase();
  const zIndex = upper.indexOf("Z");
  const head = zIndex >= 0 ? upper.slice(0, zIndex) : upper;
  const tail = zIndex >= 0 ? upper.slice(zIndex + 1) : "";

  const wordmark = (
    <span className="font-western leading-none tracking-tight text-crimson">
      {head}
      {zIndex >= 0 && (
        <span className="text-bone [text-shadow:0_0_22px_rgba(244,239,231,0.28)]">
          Z
        </span>
      )}
      {tail}
    </span>
  );

  if (variant === "compact") {
    return (
      <span className={cn("inline-flex text-xl sm:text-2xl", className)}>
        {wordmark}
      </span>
    );
  }

  if (variant === "stacked") {
    return (
      <span
        className={cn(
          "inline-flex flex-col items-center gap-3 text-center",
          className,
        )}
      >
        <span className="text-4xl sm:text-6xl">{wordmark}</span>
        {tagline && (
          <span className="flex w-full items-center gap-3">
            <span className="h-px flex-1 bg-bone/25" />
            <span className="eyebrow text-[0.6rem] whitespace-nowrap sm:text-[0.65rem]">
              {tagline}
            </span>
            <span className="h-px flex-1 bg-bone/25" />
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <span className="text-2xl sm:text-3xl">{wordmark}</span>
      {tagline && (
        <span className="eyebrow text-[0.55rem] text-muted">{tagline}</span>
      )}
    </span>
  );
}
