-- Cocina y barra dejan de tocar la pantalla.
--
-- El tablero pasa a ser algo que solo se mira —la lista de lo pendiente con el
-- tiempo que lleva esperando— y la comanda la cierra el garzon cuando va a
-- buscar el plato. El motivo es fisico: quien cocina tiene las manos mojadas o
-- con grasa, y los dos toques que pedia el flujo anterior ("empezar" y
-- "listo") no se daban nunca.
--
-- Con eso, de los tres estados de preparacion quedan dos. EN_CURSO no tiene
-- quien lo asigne, y `startedAt` —la hora en que la cocina apretaba "empezar"—
-- deja de existir en vez de quedar siempre vacio. `readyAt` pasa a llamarse
-- por lo que de verdad marca: cuando se la llevaron.

-- AlterEnum
BEGIN;
CREATE TYPE "PrepStatus_new" AS ENUM ('PENDIENTE', 'RETIRADA');
ALTER TABLE "public"."pos_order_tickets" ALTER COLUMN "prep" DROP DEFAULT;
UPDATE "pos_order_tickets" SET "prep" = 'NUEVA' WHERE "prep" = 'EN_CURSO';
ALTER TABLE "pos_order_tickets" ALTER COLUMN "prep" TYPE "PrepStatus_new" USING (
  CASE "prep"::text WHEN 'LISTA' THEN 'RETIRADA' ELSE 'PENDIENTE' END
)::"PrepStatus_new";
ALTER TYPE "PrepStatus" RENAME TO "PrepStatus_old";
ALTER TYPE "PrepStatus_new" RENAME TO "PrepStatus";
DROP TYPE "public"."PrepStatus_old";
ALTER TABLE "pos_order_tickets" ALTER COLUMN "prep" SET DEFAULT 'PENDIENTE';
COMMIT;

-- AlterTable
ALTER TABLE "pos_order_tickets" DROP COLUMN "startedAt";

-- AlterTable
ALTER TABLE "pos_order_tickets" RENAME COLUMN "readyAt" TO "pickedUpAt";
