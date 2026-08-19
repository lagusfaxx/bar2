-- Zonas del salon, garzon a cargo y etiqueta de la mesa.
--
-- Tres cosas que en la sala ya existen y en la base no estaban:
--
--   1. La zona era texto suelto en cada mesa ("terraza", "Terraza"), asi que
--      no se podia ordenar el mapa ni renombrar una zona de una vez. Pasa a
--      ser una tabla propia y las mesas la apuntan. Lo que hubiera escrito se
--      convierte en zonas, sin perder a que mesa correspondia cada una.
--   2. Quien atiende la mesa: hasta ahora solo se guardaba quien la abrio, que
--      deja de ser cierto apenas cambia el turno.
--   3. La etiqueta ("Cumpleaños", "Reservada"), que hoy se grita de una punta
--      a la otra del salon.

CREATE TABLE "pos_zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_zones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_zones_name_key" ON "pos_zones"("name");
CREATE INDEX "pos_zones_active_position_idx" ON "pos_zones"("active", "position");

ALTER TABLE "pos_tables" ADD COLUMN "zoneId" TEXT;

-- Las zonas que ya estaban escritas a mano pasan a ser zonas de verdad. El
-- orden es el de la primera mesa de cada una: en el mapa se van a ver como
-- estaban, no alfabetizadas de golpe.
INSERT INTO "pos_zones" ("id", "name", "position", "createdAt", "updatedAt")
SELECT
    md5(random()::text || clock_timestamp()::text || "name"),
    "name",
    (ROW_NUMBER() OVER (ORDER BY "orden")) - 1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT TRIM("zone") AS "name", MIN("position") AS "orden"
    FROM "pos_tables"
    WHERE "zone" IS NOT NULL AND TRIM("zone") <> ''
    GROUP BY TRIM("zone")
) AS "zonas";

UPDATE "pos_tables" AS "t"
SET "zoneId" = "z"."id"
FROM "pos_zones" AS "z"
WHERE "z"."name" = TRIM("t"."zone");

ALTER TABLE "pos_tables" DROP COLUMN "zone";

CREATE INDEX "pos_tables_zoneId_idx" ON "pos_tables"("zoneId");

ALTER TABLE "pos_tables"
    ADD CONSTRAINT "pos_tables_zoneId_fkey"
    FOREIGN KEY ("zoneId") REFERENCES "pos_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Quien atiende la mesa y como se la marca.
ALTER TABLE "pos_table_sessions"
    ADD COLUMN "attendedById" TEXT,
    ADD COLUMN "tag" TEXT,
    ADD COLUMN "tagColor" TEXT;

-- Las mesas abiertas las atiende, por ahora, quien las abrio: es lo unico que
-- se sabe de ellas y es cierto hasta que alguien diga lo contrario.
UPDATE "pos_table_sessions" SET "attendedById" = "openedById" WHERE "openedById" IS NOT NULL;

CREATE INDEX "pos_table_sessions_attendedById_status_idx" ON "pos_table_sessions"("attendedById", "status");

ALTER TABLE "pos_table_sessions"
    ADD CONSTRAINT "pos_table_sessions_attendedById_fkey"
    FOREIGN KEY ("attendedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
