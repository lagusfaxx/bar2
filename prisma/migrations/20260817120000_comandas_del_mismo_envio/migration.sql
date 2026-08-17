-- Las comandas que salieron del mismo toque de "enviar" comparten un envio.
-- Con una sola impresora eso permite sacarlas en un unico papel continuo, para
-- que el garzon retire una vez en vez de esperar a que caiga la segunda.
ALTER TABLE "pos_order_tickets" ADD COLUMN "batchId" TEXT;

CREATE INDEX "pos_order_tickets_batchId_idx" ON "pos_order_tickets"("batchId");
