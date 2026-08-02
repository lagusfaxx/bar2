import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Cabecera de una pantalla del panel. */
export function AdminHeader({
  title,
  description,
  action,
  back,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {back && (
          <Link
            href={back.href}
            className="mb-3 inline-flex text-xs text-muted transition-colors hover:text-crimson-bright"
          >
            ← {back.label}
          </Link>
        )}
        <h1 className="font-display text-2xl text-bone sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>
        )}
      </div>

      {action && <div className="flex shrink-0 flex-wrap gap-3">{action}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  className,
  action,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn("border border-line bg-ink-soft", className)}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            {title && (
              <h2 className="font-display text-lg text-bone">{title}</h2>
            )}
            {description && (
              <p className="mt-1 text-xs text-muted">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
  icon?: ReactNode;
  tone?: "default" | "crimson" | "gilt";
}) {
  const tones = {
    default: "text-bone",
    crimson: "text-crimson-bright",
    gilt: "text-gilt-soft",
  } as const;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.62rem] font-medium tracking-[0.18em] text-muted uppercase">
          {label}
        </p>
        {icon && <span className="text-muted-dark">{icon}</span>}
      </div>
      <p className={cn("mt-3 font-display text-3xl", tones[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-dark">{hint}</p>}
    </>
  );

  const className =
    "block border border-line bg-ink-soft p-5 transition-colors duration-300";

  if (href) {
    return (
      <Link href={href} className={cn(className, "hover:border-crimson/50")}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-line px-6 py-14 text-center">
      <p className="font-display text-lg text-bone">{title}</p>
      {description && (
        <p className="max-w-md text-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Tabla con desplazamiento horizontal propio en pantallas chicas. */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <div className="inline-block min-w-full px-5 align-middle sm:px-6">
        {children}
      </div>
    </div>
  );
}

export function Table({ children, ...props }: ComponentProps<"table">) {
  return (
    <table className="min-w-full text-left text-sm" {...props}>
      {children}
    </table>
  );
}

export function Th({ children, className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line px-3 py-3 text-[0.6rem] font-semibold tracking-[0.16em] text-muted uppercase",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, ...props }: ComponentProps<"td">) {
  return (
    <td
      className={cn("border-b border-line/60 px-3 py-3 align-middle", className)}
      {...props}
    >
      {children}
    </td>
  );
}

export function StatusDot({
  active,
  labelOn = "Publicado",
  labelOff = "Borrador",
}: {
  active: boolean;
  labelOn?: string;
  labelOff?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span
        className={cn(
          "size-2 rounded-full",
          active ? "bg-emerald-400" : "bg-muted-dark",
        )}
      />
      <span className={active ? "text-bone-dim" : "text-muted-dark"}>
        {active ? labelOn : labelOff}
      </span>
    </span>
  );
}
