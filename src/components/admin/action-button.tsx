"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type ActionButtonProps = {
  action: () => Promise<void>;
  children: ReactNode;
  /** Texto del diálogo de confirmación. Sin él, la acción se ejecuta directo. */
  confirm?: string;
  title?: string;
  className?: string;
  variant?: "ghost" | "danger";
  "aria-label"?: string;
};

/**
 * Ejecuta una Server Action desde una lista del panel (publicar, destacar,
 * reordenar, eliminar). Las acciones destructivas piden confirmación y el botón
 * queda deshabilitado mientras la operación está en curso.
 */
export function ActionButton({
  action,
  children,
  confirm,
  title,
  className,
  variant = "ghost",
  ...rest
}: ActionButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const variants = {
    ghost:
      "border-line text-muted hover:border-bone/40 hover:text-bone",
    danger:
      "border-line text-muted hover:border-crimson hover:text-crimson-bright",
  } as const;

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        title={title}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;

          setError(null);
          startTransition(async () => {
            try {
              await action();
            } catch (cause) {
              // Los errores de regla de negocio llegan como mensaje del servidor.
              setError(
                cause instanceof Error
                  ? cause.message
                  : "No se pudo completar la acción.",
              );
            }
          });
        }}
        className={cn(
          "inline-flex size-9 items-center justify-center border transition-colors duration-200 disabled:opacity-40",
          variants[variant],
          className,
        )}
        {...rest}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          children
        )}
      </button>

      {error && (
        <span role="alert" className="mt-1 max-w-40 text-[0.65rem] text-crimson-bright">
          {error}
        </span>
      )}
    </span>
  );
}
