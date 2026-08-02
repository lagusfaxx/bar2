"use client";

import { useActionState } from "react";

import { submitContactMessage } from "@/app/actions/public";
import {
  Field,
  FormMessage,
  HoneypotField,
  SelectField,
  SubmitButton,
  TextareaField,
} from "@/components/ui/form";
import { IDLE } from "@/lib/form-state";

const SUBJECTS = [
  "Reserva de mesa",
  "Evento privado o cumpleaños",
  "Propuesta de banda o show",
  "Prensa y colaboraciones",
  "Otra consulta",
];

export function ContactForm() {
  const [state, action] = useActionState(submitContactMessage, IDLE);

  if (state.status === "success") {
    return (
      <div className="card-bz flex flex-col gap-4 p-8">
        <FormMessage state={state} />
        <p className="text-sm text-muted">
          Si tu consulta es urgente, también podés llamarnos o escribirnos por
          WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <HoneypotField />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Nombre"
          name="name"
          required
          autoComplete="name"
          maxLength={120}
          placeholder="Tu nombre"
          error={state.errors?.name}
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
        <SelectField label="Motivo" name="subject" error={state.errors?.subject}>
          {SUBJECTS.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </SelectField>
      </div>

      <TextareaField
        label="Mensaje"
        name="message"
        required
        rows={6}
        maxLength={2000}
        placeholder="Contanos día, horario y cantidad de personas si es una reserva."
        error={state.errors?.message}
      />

      <FormMessage state={state} />

      <SubmitButton size="lg" className="self-start">
        Enviar mensaje
      </SubmitButton>

      <p className="text-xs text-muted-dark">
        Usamos tus datos solo para responderte. No compartimos información con
        terceros.
      </p>
    </form>
  );
}
