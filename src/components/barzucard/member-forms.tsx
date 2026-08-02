"use client";

import { useActionState } from "react";

import { loginMember, registerMember } from "@/app/actions/auth";
import {
  CheckboxField,
  Field,
  FormMessage,
  SubmitButton,
} from "@/components/ui/form";
import { IDLE } from "@/lib/form-state";

export function MemberRegisterForm({ loyaltyTitle }: { loyaltyTitle: string }) {
  const [state, action] = useActionState(registerMember, IDLE);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Nombre y apellido"
          name="fullName"
          required
          autoComplete="name"
          maxLength={120}
          placeholder="Como figura en tu documento"
          error={state.errors?.fullName}
        />

        <Field
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tunombre@email.com"
          error={state.errors?.email}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Teléfono"
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={40}
          placeholder="Opcional"
          error={state.errors?.phone}
        />

        <Field
          label="Fecha de nacimiento"
          name="birthDate"
          type="date"
          hint="Para el beneficio de cumpleaños."
          error={state.errors?.birthDate}
        />
      </div>

      <Field
        label="Contraseña"
        name="password"
        type="password"
        required
        autoComplete="new-password"
        placeholder="Mínimo 8 caracteres"
        error={state.errors?.password}
      />

      <div className="flex flex-col gap-3">
        <CheckboxField
          label="Quiero recibir novedades de la cartelera por email"
          name="acceptsNews"
          defaultChecked
        />

        <CheckboxField
          label={`Acepto los términos del programa ${loyaltyTitle} y la política de privacidad`}
          name="acceptsTerms"
          error={state.errors?.acceptsTerms}
        />
      </div>

      <FormMessage state={state} />

      <SubmitButton size="lg" className="self-start" pendingLabel="Creando tu tarjeta…">
        Crear mi {loyaltyTitle}
      </SubmitButton>
    </form>
  );
}

export function MemberLoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action] = useActionState(loginMember, IDLE);

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
        placeholder="tunombre@email.com"
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
