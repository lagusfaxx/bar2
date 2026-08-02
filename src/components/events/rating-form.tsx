"use client";

import { Star } from "lucide-react";
import { useActionState, useState } from "react";

import { submitEventRating } from "@/app/actions/public";
import {
  Field,
  FormMessage,
  HoneypotField,
  SubmitButton,
  TextareaField,
} from "@/components/ui/form";
import { IDLE } from "@/lib/form-state";
import { cn } from "@/lib/utils";

const LABELS = ["", "Floja", "Aceptable", "Buena", "Muy buena", "Excelente"];

export function RatingForm({ eventId }: { eventId: string }) {
  const [state, action] = useActionState(submitEventRating, IDLE);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);

  if (state.status === "success") {
    return <FormMessage state={state} />;
  }

  const shown = hovered || rating;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="rating" value={rating} />
      <HoneypotField />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[0.68rem] font-medium tracking-[0.18em] text-bone-dim uppercase">
          Tu puntuación <span className="text-crimson">*</span>
        </legend>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1"
            onMouseLeave={() => setHovered(0)}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                onMouseEnter={() => setHovered(value)}
                onFocus={() => setHovered(value)}
                onBlur={() => setHovered(0)}
                aria-label={`${value} de 5 estrellas`}
                aria-pressed={rating === value}
                className="p-1 transition-transform duration-300 hover:scale-110"
              >
                <Star
                  className={cn(
                    "size-7 transition-colors duration-200",
                    value <= shown
                      ? "fill-gilt text-gilt"
                      : "text-muted-dark",
                  )}
                  aria-hidden
                />
              </button>
            ))}
          </div>

          {shown > 0 && (
            <span className="text-sm text-bone-dim">{LABELS[shown]}</span>
          )}
        </div>

        {state.errors?.rating && (
          <p role="alert" className="text-xs text-crimson-bright">
            {state.errors.rating}
          </p>
        )}
      </fieldset>

      <Field
        label="Tu nombre"
        name="authorName"
        required
        maxLength={80}
        placeholder="Cómo querés que aparezca"
        error={state.errors?.authorName}
      />

      <TextareaField
        label="Comentario"
        name="comment"
        rows={4}
        maxLength={600}
        placeholder="¿Qué te pareció el show? (opcional)"
        error={state.errors?.comment}
        hint="Las reseñas se publican después de una breve revisión."
      />

      <FormMessage state={state} />

      <SubmitButton disabled={rating === 0} className="self-start">
        Enviar calificación
      </SubmitButton>
    </form>
  );
}
