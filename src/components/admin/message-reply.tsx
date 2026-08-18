"use client";

import { AlertTriangle, Check, CornerUpLeft } from "lucide-react";
import { useActionState, useState } from "react";

import { replyToMessage } from "@/app/actions/admin/content";
import { SubmitButton } from "@/components/ui/form";
import { IDLE } from "@/lib/form-state";

export type Reply = {
  id: string;
  body: string;
  autor: string | null;
  fecha: string;
  fallida: boolean;
  error: string | null;
};

/**
 * Responder un mensaje del formulario, sin salir del panel.
 *
 * El cuadro esta cerrado hasta que se toca "Responder". Una bandeja con
 * cincuenta mensajes y cincuenta cajas de texto abiertas no se puede leer, y
 * leer la bandeja es lo que se hace primero: contestar viene despues y de a uno.
 */
export function MessageReply({
  messageId,
  clienteEmail,
  replies,
}: {
  messageId: string;
  clienteEmail: string;
  replies: Reply[];
}) {
  const [state, action] = useActionState(replyToMessage, IDLE);
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="mt-4">
      {/* Lo ya respondido, arriba del cuadro: es el contexto que evita repetir
          o contradecir lo que otro del equipo ya prometio. */}
      {replies.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {replies.map((reply) => (
            <li
              key={reply.id}
              className={[
                "border-l-2 py-2 pl-3",
                reply.fallida ? "border-crimson bg-crimson/5" : "border-emerald-500/50",
              ].join(" ")}
            >
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                {reply.fallida ? (
                  <AlertTriangle className="size-3.5 text-crimson-bright" aria-hidden />
                ) : (
                  <Check className="size-3.5 text-emerald-400" aria-hidden />
                )}
                {reply.fallida ? "No se pudo enviar" : "Respondido"}
                {reply.autor && <span>· {reply.autor}</span>}
                <span>· {reply.fecha}</span>
              </p>

              <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-bone-dim">
                {reply.body}
              </p>

              {reply.fallida && reply.error && (
                <p className="mt-1 text-xs text-crimson-bright">{reply.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {abierto ? (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="messageId" value={messageId} />

          <label className="block">
            <span className="text-xs text-muted">
              Le llega a <span className="text-bone-dim">{clienteEmail}</span> con
              su mensaje original citado abajo.
            </span>
            <textarea
              name="body"
              rows={5}
              required
              autoFocus
              placeholder="Hola, gracias por escribirnos…"
              className="mt-2 w-full border border-line bg-ink px-3 py-2 text-sm leading-relaxed text-bone placeholder:text-muted-dark focus:border-crimson focus:outline-none"
            />
          </label>

          {state.message && (
            <p
              role="status"
              className={
                state.status === "error"
                  ? "text-sm text-crimson-bright"
                  : "text-sm text-emerald-300"
              }
            >
              {state.message}
            </p>
          )}

          <div className="flex gap-2">
            <SubmitButton className="h-11" pendingLabel="Enviando…">
              Enviar respuesta
            </SubmitButton>

            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="h-11 border border-line px-4 text-sm text-muted transition-colors hover:text-bone"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex h-10 items-center gap-2 border border-line px-4 text-sm text-muted transition-colors hover:border-crimson hover:text-bone"
        >
          <CornerUpLeft className="size-4" aria-hidden />
          {replies.length > 0 ? "Responder de nuevo" : "Responder"}
        </button>
      )}
    </div>
  );
}
