-- Karaoke: catalogo propio de canciones y cola de la noche.
--
-- El catalogo no es un lujo: la API de YouTube cobra 100 de sus 10.000
-- unidades diarias por cada busqueda, asi que sin guardar lo ya buscado el
-- local se queda sin cuota a las cien busquedas. Cada cancion encolada queda
-- aca y la siguiente vez sale gratis.

-- CreateEnum
CREATE TYPE "KaraokeEntryStatus" AS ENUM ('PEDIDA', 'EN_COLA', 'CANTANDO', 'CANTADA', 'DESCARTADA');

-- CreateEnum
CREATE TYPE "KaraokeSource" AS ENUM ('SALA', 'MESA');

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "karaokeOpen" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "karaoke_tracks" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channel" TEXT,
    "durationSeconds" INTEGER,
    "thumbnailUrl" TEXT,
    "search" TEXT NOT NULL,
    "timesQueued" INTEGER NOT NULL DEFAULT 0,
    "lastQueuedAt" TIMESTAMP(3),
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "karaoke_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "karaoke_entries" (
    "id" TEXT NOT NULL,
    "trackId" TEXT,
    "requestText" TEXT,
    "singer" TEXT NOT NULL,
    "tableId" TEXT,
    "status" "KaraokeEntryStatus" NOT NULL DEFAULT 'EN_COLA',
    "source" "KaraokeSource" NOT NULL DEFAULT 'SALA',
    "position" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "queuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "karaoke_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "karaoke_tracks_videoId_key" ON "karaoke_tracks"("videoId");

-- CreateIndex
CREATE INDEX "karaoke_tracks_blocked_timesQueued_idx" ON "karaoke_tracks"("blocked", "timesQueued");

-- CreateIndex
CREATE INDEX "karaoke_tracks_search_idx" ON "karaoke_tracks"("search");

-- CreateIndex
CREATE INDEX "karaoke_entries_status_position_idx" ON "karaoke_entries"("status", "position");

-- CreateIndex
CREATE INDEX "karaoke_entries_tableId_status_idx" ON "karaoke_entries"("tableId", "status");

-- CreateIndex
CREATE INDEX "karaoke_entries_createdAt_idx" ON "karaoke_entries"("createdAt");

-- AddForeignKey
ALTER TABLE "karaoke_entries" ADD CONSTRAINT "karaoke_entries_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "karaoke_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "karaoke_entries" ADD CONSTRAINT "karaoke_entries_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "pos_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "karaoke_entries" ADD CONSTRAINT "karaoke_entries_queuedById_fkey" FOREIGN KEY ("queuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
