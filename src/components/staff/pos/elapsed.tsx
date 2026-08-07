"use client";

import { useEffect, useState } from "react";

/**
 * Hace cuanto paso algo, en palabras cortas: "12 min", "1 h 05 min".
 *
 * Se calcula despues de montar y se refresca cada minuto: leer el reloj
 * durante el render daria un valor distinto en el servidor y en el cliente, y
 * React lo reclamaria en consola en cada mesa abierta.
 */
export function Elapsed({ since }: { since: string }) {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const update = () =>
      setMinutes(Math.max(0, Math.round((Date.now() - Date.parse(since)) / 60000)));

    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [since]);

  if (minutes === null) return null;
  if (minutes < 60) return <>{minutes} min</>;

  return (
    <>
      {Math.floor(minutes / 60)} h {String(minutes % 60).padStart(2, "0")} min
    </>
  );
}
