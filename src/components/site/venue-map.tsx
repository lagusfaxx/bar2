"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type VenueMapProps = {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  name: string;
};

/**
 * Mapa embebido de Google, centrado en las coordenadas del local.
 *
 * El iframe se monta recién cuando el bloque entra en pantalla: así la página
 * no carga scripts de terceros hasta que hacen falta, y no penaliza la primera
 * pintada ni en móvil.
 */
export function VenueMap({
  latitude,
  longitude,
  address,
  city,
  name,
}: VenueMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || load) return;

    if (typeof IntersectionObserver === "undefined") {
      setLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [load]);

  const embedSrc = `https://www.google.com/maps?q=${latitude},${longitude}&hl=es&z=17&output=embed`;

  return (
    <div
      ref={ref}
      className="relative aspect-4/3 w-full overflow-hidden border border-line bg-surface sm:aspect-16/9"
    >
      {load ? (
        <iframe
          src={embedSrc}
          title={`Mapa de ${name} — ${address}, ${city}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className="absolute inset-0 size-full border-0 grayscale-[35%] contrast-110"
        />
      ) : (
        // Marcador de posición con el mismo tamaño: evita saltos de layout.
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(120%_100%_at_50%_0%,var(--color-surface-2),var(--color-ink))]">
          <MapPin className="size-7 animate-pulse text-crimson" aria-hidden />
          <p className="text-sm text-muted">Cargando el mapa…</p>
        </div>
      )}
    </div>
  );
}
