"use client";

import { useActionState } from "react";

import { loginPanel } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { IDLE } from "@/lib/form-state";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action] = useActionState(loginPanel, IDLE);

  return (
    <form action={action} className="flex flex-col gap-5">
      {redirectTo && <input type="hidden" name="volver" value={redirectTo} />}

      <Field
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="username"
        autoFocus
        placeholder="admin@barzuo.com"
        error={state.errors?.email}
      />

      <Field
        label="Contraseña"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        placeholder="••••••••"
        error={state.errors?.password}
      />

      <FormMessage state={state} />

      <SubmitButton size="lg" className="w-full" pendingLabel="Ingresando…">
        Ingresar
      </SubmitButton>
    </form>
  );
}
