import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  image?: string | null;
  children?: ReactNode;
  className?: string;
};

/**
 * Cabecera comun de las paginas internas: mantiene el ritmo del hero de la
 * portada pero en una altura contenida, para que el contenido empiece antes.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  image,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "relative isolate overflow-hidden border-b border-line pt-32 pb-16 sm:pt-40 sm:pb-20",
        className,
      )}
    >
      <div className="absolute inset-0 -z-10">
        {image && (
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-45"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink/70 to-ink" />
        <div
          aria-hidden
          className="absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-crimson/12 blur-[130px]"
        />
      </div>

      <div className="container-bz">
        {eyebrow && (
          <div className="mb-5 flex items-center gap-3">
            <span className="h-px w-8 bg-crimson" />
            <span className="eyebrow text-crimson-bright">{eyebrow}</span>
          </div>
        )}

        <h1 className="max-w-4xl text-[clamp(2.25rem,6.5vw,4.5rem)] leading-[1.02]">
          {title}
        </h1>

        {lead && (
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            {lead}
          </p>
        )}

        {children && <div className="mt-9">{children}</div>}
      </div>
    </header>
  );
}
