-- Correo: avisos internos, tarjeta por mail, recuperar contrasena, cumpleanos
-- y campanas. Hasta ahora el sistema no enviaba un solo correo.

CREATE TYPE "EmailKind" AS ENUM ('CONTACTO', 'BIENVENIDA', 'TARJETA', 'RECUPERAR', 'CUMPLEANOS', 'CAMPANA');
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'FAILED');
CREATE TYPE "CampaignAudience" AS ENUM ('SUSCRITOS', 'TODOS', 'PRUEBA');

-- A quien se le avisa de un mensaje del formulario. Varias direcciones
-- separadas por coma; vive en los ajustes para poder cambiarlo sin desplegar.
ALTER TABLE "site_settings" ADD COLUMN "notifyEmails" TEXT;

-- El ano del ultimo saludo, para no saludar dos veces en la misma ventana.
ALTER TABLE "members" ADD COLUMN "birthdayGreetedYear" INTEGER;

-- Promocion que solo puede canjear quien esta de cumpleanos.
ALTER TABLE "promotions" ADD COLUMN "birthdayOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "promotions" ADD COLUMN "birthdayWindowDays" INTEGER NOT NULL DEFAULT 7;

CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "html" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "audience" "CampaignAudience" NOT NULL DEFAULT 'SUSCRITOS',
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "kind" "EmailKind" NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'SENT',
    "providerId" TEXT,
    "error" TEXT,
    "memberId" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- Se guarda el hash del token, nunca el token: quien lea esta tabla no puede
-- entrar a ninguna cuenta con lo que hay aca.
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "campaigns_status_createdAt_idx" ON "campaigns"("status", "createdAt");

CREATE INDEX "email_logs_kind_createdAt_idx" ON "email_logs"("kind", "createdAt");
CREATE INDEX "email_logs_memberId_idx" ON "email_logs"("memberId");
CREATE INDEX "email_logs_campaignId_idx" ON "email_logs"("campaignId");
CREATE INDEX "email_logs_status_createdAt_idx" ON "email_logs"("status", "createdAt");

CREATE UNIQUE INDEX "password_resets_tokenHash_key" ON "password_resets"("tokenHash");
CREATE INDEX "password_resets_memberId_idx" ON "password_resets"("memberId");
CREATE INDEX "password_resets_expiresAt_idx" ON "password_resets"("expiresAt");

ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
