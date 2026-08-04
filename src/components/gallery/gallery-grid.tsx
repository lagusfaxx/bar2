"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type GalleryItem = {
  id: string;
  url: string;
  alt: string;
  caption: string | null;
  tag: string | null;
  event: { slug: string; title: string } | null;
};

/**
 * Mosaico de galería con filtro por etiqueta y visor a pantalla completa.
 *
 * El mosaico usa columnas CSS (masonry real, sin JavaScript de posicionamiento)
 * y el visor se maneja por teclado y por gestos de deslizamiento en móvil.
 */
export function GalleryGrid({ images }: { images: GalleryItem[] }) {
  const [tag, setTag] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const tags = useMemo(() => {
    const found = new Set<string>();
    for (const image of images) {
      if (image.tag) found.add(image.tag);
    }
    return [...found].sort((a, b) => a.localeCompare(b, "es"));
  }, [images]);

  const visible = useMemo(
    () => (tag ? images.filter((image) => image.tag === tag) : images),
    [images, tag],
  );

  const close = useCallback(() => setOpenIndex(null), []);

  const move = useCallback(
    (delta: number) => {
      setOpenIndex((current) => {
        if (current === null) return current;
        // Recorrido circular: del último se vuelve al primero.
        return (current + delta + visible.length) % visible.length;
      });
    },
    [visible.length],
  );

  useEffect(() => {
    if (openIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openIndex, close, move]);

  const current = openIndex !== null ? visible[openIndex] : null;

  return (
    <>
      {tags.length > 1 && (
        <div className="mb-10 flex flex-wrap gap-2">
          <FilterChip active={tag === null} onClick={() => setTag(null)}>
            Todas
          </FilterChip>
          {tags.map((value) => (
            <FilterChip
              key={value}
              active={tag === value}
              onClick={() => setTag(value)}
            >
              {value}
            </FilterChip>
          ))}
        </div>
      )}

      <div className="columns-2 gap-3 sm:gap-4 lg:columns-3 xl:columns-4">
        {visible.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            aria-label={`Ampliar: ${image.alt}`}
            className="group relative mb-3 block w-full overflow-hidden sm:mb-4"
          >
            <Image
              src={image.url}
              alt={image.alt}
              width={800}
              height={1000}
              sizes="(max-width: 640px) 45vw, (max-width: 1280px) 30vw, 23vw"
              className="h-auto w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
            />

            <span className="scrim absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            {image.caption && (
              <span className="absolute inset-x-0 bottom-0 translate-y-3 p-4 text-left opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                <span className="block font-display text-base text-bone">
                  {image.caption}
                </span>
                {image.event && (
                  <span className="mt-0.5 block text-xs text-crimson-bright">
                    {image.event.title}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="card-bz p-12 text-center text-muted">
          No hay fotos en esta categoría todavía.
        </p>
      )}

      {/* Visor */}
      {current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={current.alt}
          className="fixed inset-0 z-100 flex flex-col bg-ink animate-fade-in"
          onClick={close}
          onTouchStart={(event) => setTouchStartX(event.touches[0]!.clientX)}
          onTouchEnd={(event) => {
            if (touchStartX === null) return;
            const delta = event.changedTouches[0]!.clientX - touchStartX;
            // Umbral generoso para no confundir un toque con un deslizamiento.
            if (Math.abs(delta) > 60) move(delta < 0 ? 1 : -1);
            setTouchStartX(null);
          }}
        >
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <p className="text-sm text-muted tabular-nums">
              {openIndex! + 1} / {visible.length}
            </p>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar"
              className="flex size-11 items-center justify-center border border-line text-bone transition-colors hover:border-crimson hover:text-crimson-bright"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <div
            className="relative flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Imagen anterior"
              className="absolute left-2 z-10 flex size-12 items-center justify-center border border-line bg-ink/70 text-bone transition-colors hover:border-crimson hover:text-crimson-bright sm:left-6"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>

            <Image
              key={current.id}
              src={current.url}
              alt={current.alt}
              width={1600}
              height={1600}
              sizes="100vw"
              className="max-h-full w-auto max-w-full animate-fade-in object-contain"
              // Se monta al abrir el visor, ya con la pagina cargada: un
              // preload en la cabecera llegaria tarde y no serviria de nada.
              // Lo que hace falta es que esta peticion se adelante a las demas.
              loading="eager"
              fetchPriority="high"
            />

            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Imagen siguiente"
              className="absolute right-2 z-10 flex size-12 items-center justify-center border border-line bg-ink/70 text-bone transition-colors hover:border-crimson hover:text-crimson-bright sm:right-6"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>

          {(current.caption || current.event) && (
            <div
              className="border-t border-line px-5 py-5 text-center"
              onClick={(event) => event.stopPropagation()}
            >
              {current.caption && (
                <p className="font-display text-lg text-bone">
                  {current.caption}
                </p>
              )}
              {current.event && (
                <Link
                  href={`/eventos/${current.event.slug}`}
                  className="mt-1 inline-block text-sm text-crimson-bright underline-offset-4 hover:underline"
                >
                  Ver evento: {current.event.title}
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "border px-4 py-2.5 text-[0.65rem] font-medium tracking-[0.16em] uppercase transition-colors duration-300",
        active
          ? "border-crimson bg-crimson text-bone"
          : "border-line text-muted hover:border-bone/30 hover:text-bone",
      )}
    >
      {children}
    </button>
  );
}
