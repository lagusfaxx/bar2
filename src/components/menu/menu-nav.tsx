"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type MenuNavProps = {
  categories: Array<{ slug: string; name: string }>;
};

/**
 * Navegación por categorías de la carta. Se pega debajo de la barra superior y
 * marca la sección visible mientras se hace scroll. En móvil desplaza en
 * horizontal, con la categoría activa siempre a la vista.
 */
export function MenuNav({ categories }: MenuNavProps) {
  const [active, setActive] = useState(categories[0]?.slug ?? "");
  const trackRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const sections = categories
      .map((category) => document.getElementById(category.slug))
      .filter((element): element is HTMLElement => !!element);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // La sección "activa" es la más cercana al tope de la ventana.
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];

        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [categories]);

  /**
   * Mantiene el chip activo dentro del área visible del carrusel.
   *
   * Se mueve `scrollLeft` a mano en lugar de usar `scrollIntoView`: ese método
   * desplaza también a los ancestros que puedan desplazarse —incluida la
   * página— así que al bajar por la carta el navegador movía el scroll
   * vertical por su cuenta, peleando con el dedo. Aquí solo se toca la barra.
   */
  useEffect(() => {
    const track = trackRef.current;
    const chip = track?.querySelector<HTMLElement>(`[data-menu-chip="${active}"]`);

    if (!track || !chip) return;

    const target =
      chip.offsetLeft - track.clientWidth / 2 + chip.offsetWidth / 2;

    track.scrollTo({
      left: Math.max(0, target),
      behavior: "smooth",
    });
  }, [active]);

  return (
    <nav
      aria-label="Categorías de la carta"
      className="sticky top-18 z-30 border-y border-line bg-ink/97 sm:top-20 lg:bg-ink/92 lg:backdrop-blur-xl"
    >
      <div className="container-bz">
        <ul
          ref={trackRef}
          className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto overscroll-x-contain py-3"
        >
          {categories.map((category) => (
            <li key={category.slug} className="shrink-0">
              <a
                href={`#${category.slug}`}
                data-menu-chip={category.slug}
                aria-current={active === category.slug ? "true" : undefined}
                className={cn(
                  "block px-4 py-2.5 text-[0.68rem] font-medium tracking-[0.16em] uppercase transition-colors duration-300",
                  active === category.slug
                    ? "bg-crimson text-bone"
                    : "text-muted hover:text-bone",
                )}
              >
                {category.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
