import { Archive, Mail, MailOpen, Trash2 } from "lucide-react";

import {
  archiveMessage,
  deleteMessage,
  setMessageRead,
} from "@/app/actions/admin/content";
import { ActionButton } from "@/components/admin/action-button";
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
    orderBy: [{ read: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <>
      <AdminHeader
        title="Mensajes de contacto"
        description="Consultas y reservas que llegan desde el formulario del sitio."
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
