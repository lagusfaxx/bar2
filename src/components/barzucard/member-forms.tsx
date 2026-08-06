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

  /*
   * Una sola columna, en dos bloques.
   *
   * Los campos venian de a dos por fila en pantallas medianas y en el telefono
   * se desarmaban en una escalera de seis cajas sin agrupacion visible: nombre,
   * email, telefono y cumpleaños pesaban lo mismo que la clave. Ahora lo
   * obligatorio va primero y lo opcional queda separado y dicho como tal.
   */
  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-5">
        <Field
          label="Nombre y apellido"
          name="fullName"
          required
          autoComplete="name"
          maxLength={120}
          placeholder="Camila Rojas"
          error={state.errors?.fullName}
        />

        <Field
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tunombre@email.com"
          hint="Con este email entras a tu tarjeta desde cualquier teléfono."
          error={state.errors?.email}
        />

        <Field
          label="Contraseña"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          error={state.errors?.password}
        />
      </div>

      <div className="flex flex-col gap-5 border-t border-line pt-6">
        <p className="text-[0.68rem] font-medium tracking-[0.18em] text-muted uppercase">
          Opcional
        </p>

        <Field
          label="Teléfono"
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={40}
          placeholder="+56 9 1234 5678"
          error={state.errors?.phone}
        />

        <Field
          label="Fecha de nacimiento"
          name="birthDate"
          type="date"
          hint="Para el brindis de cumpleaños."
          error={state.errors?.birthDate}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-6">
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

      {/* Ancho completo: en el telefono el boton ocupaba media pantalla y
          quedaba pegado al borde izquierdo, como si fuera secundario. */}
      <SubmitButton size="lg" className="w-full" pendingLabel="Creando tu tarjeta…">
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
