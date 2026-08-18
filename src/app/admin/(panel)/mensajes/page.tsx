import { Archive, Mail, MailOpen, Trash2 } from "lucide-react";

import {
  archiveMessage,
  deleteMessage,
  setMessageRead,
} from "@/app/actions/admin/content";
import { ActionButton } from "@/components/admin/action-button";
import { MessageReply } from "@/components/admin/message-reply";
import { AdminHeader, EmptyState, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/section";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Mensajes" };

export default async function AdminMensajesPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { ver } = await searchParams;
  const showArchived = ver === "archivados";

  const messages = await prisma.contactMessage.findMany({
    where: { archived: showArchived },
    /*
     * Primero lo que falta contestar.
     *
     * Antes ordenaba por leido, y eso escondia el caso que importa: un mensaje
     * leido y sin responder queda mas abajo que uno recien llegado, aunque sea
     * el que lleva tres dias esperando. Sin responder va arriba de todo.
     */
    orderBy: [
      // `nulls: "first"` no es adorno: en Postgres los nulos ordenan al final
      // con ASC, asi que sin esto los mensajes sin responder —que son
      // justamente los que hay que ver— quedarian ultimos.
      { answeredAt: { sort: "asc", nulls: "first" } },
      { read: "asc" },
      { createdAt: "desc" },
    ],
    take: 200,
    include: {
      replies: {
        orderBy: { createdAt: "asc" },
        include: { sentBy: { select: { name: true } } },
      },
    },
  });

  return (
    <>
      <AdminHeader
        title="Mensajes de clientes"
        description="Consultas y pedidos de reserva que llegan por el formulario de la web."
      />

      <div className="mb-6 flex gap-2">
        <a
          href="/admin/mensajes"
          className={
            !showArchived
              ? "border border-crimson bg-crimson px-4 py-2 text-[0.65rem] font-medium tracking-[0.16em] text-bone uppercase"
              : "border border-line px-4 py-2 text-[0.65rem] font-medium tracking-[0.16em] text-muted uppercase transition-colors hover:text-bone"
          }
        >
          Bandeja
        </a>
        <a
          href="/admin/mensajes?ver=archivados"
          className={
            showArchived
              ? "border border-crimson bg-crimson px-4 py-2 text-[0.65rem] font-medium tracking-[0.16em] text-bone uppercase"
              : "border border-line px-4 py-2 text-[0.65rem] font-medium tracking-[0.16em] text-muted uppercase transition-colors hover:text-bone"
          }
        >
          Archivados
        </a>
      </div>

      <Panel>
        {messages.length === 0 ? (
          <EmptyState
            title={showArchived ? "No hay mensajes archivados" : "La bandeja está vacía"}
            description="Los mensajes del formulario de contacto aparecen aquí."
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {messages.map((message) => (
              <li
                key={message.id}
                className="flex flex-col gap-3 border border-line bg-ink p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-bone">{message.name}</p>
                    {!message.read && <Badge tone="crimson">Sin leer</Badge>}
                    {message.answeredAt && <Badge tone="muted">Respondido</Badge>}
                    {message.subject && (
                      <Badge tone="muted">{message.subject}</Badge>
                    )}
                  </div>

                  <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted">
                    <a
                      href={`mailto:${message.email}`}
                      className="hover:text-crimson-bright"
                    >
                      {message.email}
                    </a>
                    {message.phone && (
                      <a
                        href={`tel:${message.phone}`}
                        className="hover:text-crimson-bright"
                      >
                        {message.phone}
                      </a>
                    )}
                  </p>

                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-bone-dim">
                    {message.message}
                  </p>

                  <p className="mt-3 text-xs text-muted-dark">
                    {formatDateTime(message.createdAt)}
                  </p>

                  <MessageReply
                    messageId={message.id}
                    clienteEmail={message.email}
                    replies={message.replies.map((reply) => ({
                      id: reply.id,
                      body: reply.body,
                      autor: reply.sentBy?.name ?? null,
                      fecha: formatDateTime(reply.createdAt),
                      fallida: reply.status === "FAILED",
                      error: reply.error,
                    }))}
                  />
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <ActionButton
                    action={async () => {
                      "use server";
                      await setMessageRead(message.id, !message.read);
                    }}
                    title={message.read ? "Marcar como no leído" : "Marcar como leído"}
                    aria-label={
                      message.read ? "Marcar como no leído" : "Marcar como leído"
                    }
                  >
                    {message.read ? (
                      <Mail className="size-4" aria-hidden />
                    ) : (
                      <MailOpen className="size-4" aria-hidden />
                    )}
                  </ActionButton>

                  {!message.archived && (
                    <ActionButton
                      action={async () => {
                        "use server";
                        await archiveMessage(message.id);
                      }}
                      title="Archivar"
                      aria-label="Archivar mensaje"
                    >
                      <Archive className="size-4" aria-hidden />
                    </ActionButton>
                  )}

                  <ActionButton
                    variant="danger"
                    confirm="¿Eliminar este mensaje definitivamente?"
                    action={async () => {
                      "use server";
                      await deleteMessage(message.id);
                    }}
                    title="Eliminar"
                    aria-label="Eliminar mensaje"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
