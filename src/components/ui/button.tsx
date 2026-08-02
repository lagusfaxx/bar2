import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "gilt" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium uppercase tracking-[0.18em] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] disabled:pointer-events-none disabled:opacity-45 rounded-[3px]";

const variants: Record<Variant, string> = {
  // Boton principal: el barrido de luz aparece solo al pasar el mouse.
  primary:
    "bg-crimson text-bone overflow-hidden hover:bg-crimson-bright hover:shadow-[0_18px_45px_-18px_rgba(225,29,42,0.9)] before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent before:transition-transform before:duration-700 hover:before:translate-x-full",
  outline:
    "border border-bone/25 text-bone hover:border-crimson hover:bg-crimson/10 hover:text-bone",
  ghost: "text-bone-dim hover:text-bone hover:bg-bone/5",
  gilt: "bg-gilt text-ink hover:bg-gilt-soft",
  danger:
    "border border-crimson/45 text-crimson-bright hover:bg-crimson hover:text-bone",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[0.65rem]",
  md: "h-11 px-6 text-[0.7rem]",
  lg: "h-14 px-8 text-[0.75rem]",
};

type BaseProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: BaseProps & ComponentProps<"button">) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
      </span>
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: BaseProps & ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
      </span>
    </Link>
  );
}

/** Variante para enlaces externos (entradas, mapas, redes). */
export function ButtonAnchor({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: BaseProps & ComponentProps<"a">) {
  return (
    <a
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
      </span>
    </a>
  );
}
