-- La venta de mostrador, registrada.
--
-- Hasta ahora todo cobro pasaba por una mesa: abrir turno, cargar, cobrar,
-- cerrar. Pero buena parte de la noche se vende de otra forma —alguien se
-- acerca a la barra, pide una cerveza y la paga al tiro— y eso no tenia donde
-- anotarse. La plata entraba a la caja y el consumo no quedaba en ningun lado:
-- el cierre del dia, lo que mas se vende y cualquier control de lo que salio
-- de la barra quedaban cortos todas las noches.
--
-- Una venta directa es una cuenta sin mesa: nace cobrada y cerrada en la misma
-- operacion. Por eso "tableId" pasa a ser opcional —no hubo mesa, y poner una
-- falsa seria mentir en la unica tabla que despues se audita— y "kind"
-- distingue las dos formas sin tener que adivinarlo por el codigo.
--
-- Todo lo que ya existe queda como MESA: es exactamente lo que era.

-- CreateEnum
CREATE TYPE "SessionKind" AS ENUM ('MESA', 'DIRECTA');

-- AlterTable
ALTER TABLE "pos_table_sessions"
    ADD COLUMN "kind" "SessionKind" NOT NULL DEFAULT 'MESA',
    ALTER COLUMN "tableId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "pos_table_sessions_kind_openedAt_idx" ON "pos_table_sessions"("kind", "openedAt");
