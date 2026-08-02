"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/form-state";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full border border-line bg-ink-soft px-4 py-3 text-sm text-bone placeholder:text-muted-dark transition-colors duration-300 focus:border-crimson focus:outline-none disabled:opacity-50";

type FieldProps = {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children?: ReactNode;
};

function FieldShell({
  label,
  name,
  error,
  hint,
  required,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={name}
        className="text-[0.68rem] font-medium tracking-[0.18em] text-bone-dim uppercase"
      >
        {label}
        {required && <span className="ml-1 text-crimson">*</span>}
      </label>

      {children}

      {hint && !error && <p className="text-xs text-muted-dark">{hint}</p>}

      {error && (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-xs text-crimson-bright"
        >
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

export function Field({
  label,
  name,
  error,
  hint,
  required,
  className,
  ...props
}: FieldProps & ComponentProps<"input">) {
  return (
    <FieldShell
      label={label}
      name={name}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <input
        id={name}
        name={name}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className={cn(fieldBase, error && "border-crimson")}
        {...props}
      />
    </FieldShell>
  );
}

export function TextareaField({
  label,
  name,
  error,
  hint,
  required,
  className,
  ...props
}: FieldProps & ComponentProps<"textarea">) {
  return (
    <FieldShell
      label={label}
      name={name}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <textarea
        id={name}
        name={name}
        required={required}
        aria-invalid={!!error}
        rows={5}
        className={cn(fieldBase, "resize-y", error && "border-crimson")}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  error,
  hint,
  required,
  className,
  children,
  ...props
}: FieldProps & ComponentProps<"select">) {
  return (
    <FieldShell
      label={label}
      name={name}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <select
        id={name}
        name={name}
        required={required}
        aria-invalid={!!error}
        className={cn(fieldBase, "appearance-none", error && "border-crimson")}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  label,
  name,
  hint,
  error,
  className,
  ...props
}: Omit<FieldProps, "children"> & ComponentProps<"input">) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="flex cursor-pointer items-start gap-3 text-sm text-bone-dim">
        <input
          id={name}
          name={name}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-crimson"
          {...props}
        />
        <span>{label}</span>
      </label>

      {hint && <p className="pl-7 text-xs text-muted-dark">{hint}</p>}
      {error && (
        <p role="alert" className="pl-7 text-xs text-crimson-bright">
          {error}
        </p>
      )}
    </div>
  );
}

/** Campo trampa invisible: los bots lo completan, las personas no lo ven. */
export function HoneypotField() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label htmlFor="website">No completar</label>
      <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Enviando…",
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Aviso de resultado de la acción, anunciado a lectores de pantalla. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;

  const isSuccess = state.status === "success";

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2.5 border px-4 py-3 text-sm",
        isSuccess
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          : "border-crimson/50 bg-crimson/10 text-crimson-bright",
      )}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      {state.message}
    </p>
  );
}
