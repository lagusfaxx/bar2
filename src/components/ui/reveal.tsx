import type { CSSProperties, ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  /** Retraso relativo, para escalonar elementos de una misma fila. */
  delay?: number;
  /**
   * Aparece solo atenuando la opacidad, sin subir desde abajo.
   *
   * Es lo que corresponde en los carruseles horizontales: ahi el movimiento
   * vertical se nota como un salto y, si el elemento es punto de enganche del
   * scroll, desplaza los puntos de snap mientras dura la animacion.
   */
  fade?: boolean;
  className?: string;
  as?: ElementType;
};

/**
 * Revelado al entrar en pantalla, resuelto enteramente por CSS.
 *
 * No lleva "use client": es un componente de servidor y no aporta un solo byte
 * de JavaScript. Antes era lo contrario —estado, efecto e IntersectionObserver
 * por cada bloque de cada pagina— y el precio no era el peso del archivo sino
 * el orden: el contenido nacia invisible y no se encendia hasta que React
 * hidrataba. En un telefono lento eso dejaba el sitio en negro varios segundos
 * despues de que el HTML ya habia llegado.
 *
 * La animacion vive en globals.css, conducida por `animation-timeline: view()`
 * y encerrada en un `@supports`: donde no se entiende, el contenido
 * simplemente se ve.
 *
 * El `delay` ya no son milisegundos —con el scroll marcando el tiempo no
 * existen— sino un corrimiento del tramo de scroll en que ocurre la animacion.
 * Se conserva el nombre y la escala del parametro para no tocar las decenas de
 * llamadas que ya lo pasaban, y se acota para que el ultimo elemento de una
 * fila no quede esperando media pantalla de mas.
 */
export function Reveal({
  children,
  delay = 0,
  fade = false,
  className,
  as: Tag = "div",
}: RevealProps) {
  const shift = Math.min(delay / 20, 8);

  return (
    <Tag
      data-reveal={fade ? "fade" : ""}
      style={
        shift ? ({ "--reveal-shift": `${shift}%` } as CSSProperties) : undefined
      }
      className={cn(className)}
    >
      {children}
    </Tag>
  );
}
