-- Vuelve atras las zonas, el garzon a cargo y las etiquetas de mesa.
--
-- Se revierte la funcionalidad completa a pedido: en la pantalla tactil del
-- local dejo la sala pesada y sin cargar. La migracion anterior no se borra
-- —una migracion ya aplicada nunca se saca del historial, o el despliegue deja
-- de poder migrar—: se deshace con esta, que va hacia adelante como cualquier
-- otra.
--
-- La zona vuelve a ser texto en la mesa, con el nombre que tenia la zona: lo
-- que se cargo desde el panel no se pierde.

ALTER TABLE "pos_tables" ADD COLUMN "zone" TEXT;

UPDATE "pos_tables" AS "t"
SET "zone" = "z"."name"
FROM "pos_zones" AS "z"
WHERE "z"."id" = "t"."zoneId";

ALTER TABLE "pos_tables" DROP CONSTRAINT "pos_tables_zoneId_fkey";
DROP INDEX "pos_tables_zoneId_idx";
ALTER TABLE "pos_tables" DROP COLUMN "zoneId";

DROP TABLE "pos_zones";

ALTER TABLE "pos_table_sessions" DROP CONSTRAINT "pos_table_sessions_attendedById_fkey";
DROP INDEX "pos_table_sessions_attendedById_status_idx";
ALTER TABLE "pos_table_sessions"
    DROP COLUMN "attendedById",
    DROP COLUMN "tag",
    DROP COLUMN "tagColor";
