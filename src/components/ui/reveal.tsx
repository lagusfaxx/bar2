"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  /** Retraso en ms, para escalonar elementos de una misma fila. */
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
 * Revelado al entrar en pantalla mediante IntersectionObserver.
 *
 * Se prefiere esto a una libreria de animacion: no agrega JavaScript al bundle
 * mas alla de este archivo, la transicion la resuelve CSS (ver globals.css) y
 * respeta prefers-reduced-motion automaticamente.
 */
export function Reveal({
  children,
  delay = 0,
  fade = false,
  className,
  as: Tag = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;

    // Sin soporte de IntersectionObserver mostramos el contenido igual.
    if (typeof IntersectionObserver === "undefined") {
      const timer = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <Tag
      ref={ref}
      data-reveal={visible ? "in" : ""}
      data-reveal-fade={fade ? "" : undefined}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
      className={cn(className)}
    >
      {children}
    </Tag>
  );
}
