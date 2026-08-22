-- El cobro que no fue.
--
-- Dos cosas que pasan de verdad y que hasta ahora solo se arreglaban entrando a
-- la base: la prueba que alguien hace con el POS antes de abrir el local, y el
-- cobro que sale mal —la mesa equivocada, el metodo equivocado—. Las dos
-- quedaban sumando en el cierre del dia.
--
-- Se anula y no se borra. Un cobro que desaparece sin dejar rastro es
-- justamente lo que hay que poder auditar despues: quien lo anulo, cuando y por
-- que. Anulado sale de todas las cifras del dia y queda listado aparte.
ALTER TABLE "pos_payments"
    ADD COLUMN "voidedAt" TIMESTAMP(3),
    ADD COLUMN "voidReason" TEXT,
    ADD COLUMN "voidedById" TEXT;

ALTER TABLE "pos_payments"
    ADD CONSTRAINT "pos_payments_voidedById_fkey"
    FOREIGN KEY ("voidedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- El cierre pide los cobros de la jornada y separa los anulados de los buenos.
DROP INDEX "pos_payments_paidAt_idx";
CREATE INDEX "pos_payments_paidAt_voidedAt_idx" ON "pos_payments"("paidAt", "voidedAt");
