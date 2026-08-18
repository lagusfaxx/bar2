-- Responder desde el panel un mensaje del formulario, y que le llegue por
-- correo a quien escribio. Se guarda el texto ademas de mandarlo: si no, lo
-- unico que queda de la conversacion es un correo en la casilla del cliente y
-- el resto del equipo no sabe que ya se respondio ni que se prometio.

ALTER TABLE "contact_messages" ADD COLUMN "answeredAt" TIMESTAMP(3);

CREATE INDEX "contact_messages_answeredAt_idx" ON "contact_messages"("answeredAt");

CREATE TABLE "contact_replies" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentById" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'SENT',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_replies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_replies_messageId_createdAt_idx" ON "contact_replies"("messageId", "createdAt");

ALTER TABLE "contact_replies" ADD CONSTRAINT "contact_replies_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "contact_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_replies" ADD CONSTRAINT "contact_replies_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
