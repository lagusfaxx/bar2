-- Karaoke de autoservicio: las mesas buscan, eligen y entran solas a la cola.
--
-- Lo unico que necesita la base es recordar que busquedas ya se le pagaron a
-- YouTube. Los videos en si ya se guardan en karaoke_tracks.
CREATE TABLE "karaoke_searches" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "karaoke_searches_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "karaoke_searches_createdAt_idx" ON "karaoke_searches"("createdAt");
