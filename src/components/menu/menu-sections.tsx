"use client";

import { ChevronDown } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type MenuSectionData = {
  slug: string;
  name: string;
  /** Cantidad de productos, para anticipar el tamaño de la sección cerrada. */
  count: number;
  /** Columna de presentación (imagen, número y descripción). */
  aside: ReactNode;
  /** Lista de productos. */
  items: ReactNode;
};

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * La carta, sección por sección.
 *
 * En el teléfono la carta completa son casi cien productos: apilados uno tras
 * otro, la página se vuelve interminable y el resto del sitio queda enterrado.
 * Por eso en móvil cada categoría se pliega y solo se abre la que interesa —
 * las quince categorías entran en una pantalla y media. En escritorio, donde
 * hay espacio y dos columnas, todo se muestra abierto: el CSS ignora el estado
 * y no hace falta medir el ancho en JavaScript.
 */
export function MenuSections({ sections }: { sections: MenuSectionData[] }) {
  // El ancla de la URL manda: llegar desde el menú de categorías (o desde un
  // enlace compartido) abre esa categoría.
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash.slice(1),
    () => "",
  );

  const targeted = sections.some((section) => section.slug === hash) ? hash : null;

  /**
   * Apertura manual, atada al ancla vigente cuando se tocó. Al cambiar el ancla
   * el valor queda obsoleto y se descarta solo, sin sincronizar nada en un
   * efecto.
   */
  const [manual, setManual] = useState<{
    anchor: string;
    slug: string | null;
  } | null>(null);

  const anchor = targeted ?? "";
  const open =
    manual && manual.anchor === anchor
      ? manual.slug
      : (targeted ?? sections[0]?.slug ?? null);

  return (
    <div className="pb-10">
      {sections.map((section, index) => {
        const expanded = open === section.slug;

        return (
          <section
            key={section.slug}
            id={section.slug}
            style={{ scrollMarginTop: "8.5rem" }}
            className={cn(
              "border-t border-line",
              index % 2 === 1 && "bg-ink-soft",
              "py-2 lg:py-28",
            )}
          >
            <div className="container-bz">
              {/* Cabecera plegable: solo existe en móvil. El titulo envuelve al
                  boton (patron de acordeon accesible) para que la jerarquia de
                  encabezados de la carta se mantenga en el telefono. */}
              <h2 className="lg:hidden">
                <button
                  type="button"
                  onClick={() =>
                    setManual({
                      anchor,
                      slug: expanded ? null : section.slug,
                    })
                  }
                  aria-expanded={expanded}
                  aria-controls={`carta-${section.slug}`}
                  className="-mx-1 flex w-full items-center gap-3 px-1 py-4 text-left"
                >
                  <span className="eyebrow shrink-0 text-crimson-bright">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="min-w-0 flex-1 font-display text-xl leading-tight text-bone">
                    {section.name}
                  </span>

                  <span className="shrink-0 text-[0.7rem] text-muted-dark tabular-nums">
                    {section.count}
                  </span>

                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0 text-muted transition-transform duration-300",
                      expanded && "rotate-180 text-crimson-bright",
                    )}
                  />
                </button>
              </h2>

              <div
                id={`carta-${section.slug}`}
                className={cn(
                  "gap-10 lg:grid lg:grid-cols-[20rem_1fr] lg:gap-16",
                  expanded ? "grid pb-8" : "hidden",
                  "lg:pb-0",
                )}
              >
                {section.aside}
                {section.items}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
