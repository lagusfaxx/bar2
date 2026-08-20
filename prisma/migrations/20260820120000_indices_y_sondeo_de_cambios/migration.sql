-- Marca de ultimo cambio del turno de mesa.
--
-- Las pantallas de sala preguntan "¿cambio algo?" en vez de volver a armar la
-- vista entera cada diez segundos. Para responder esa pregunta hace falta poder
-- mirar el maximo de esta columna sin recorrer la tabla.
ALTER TABLE "pos_table_sessions"
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "pos_table_sessions_updatedAt_idx" ON "pos_table_sessions"("updatedAt");
CREATE INDEX "pos_order_items_updatedAt_idx" ON "pos_order_items"("updatedAt");
CREATE INDEX "pos_order_tickets_updatedAt_idx" ON "pos_order_tickets"("updatedAt");

-- Las lineas de una comanda. Las piden la pantalla de cocina, la de barra y la
-- cola de impresion en cada vuelta; sin indice, cada una recorria toda la tabla
-- de lineas del historico.
CREATE INDEX "pos_order_items_ticketId_idx" ON "pos_order_items"("ticketId");

-- "Lo que mas se vende": agrupa por producto sobre los ultimos catorce dias.
CREATE INDEX "pos_order_items_createdAt_idx" ON "pos_order_items"("createdAt");

-- La cola de impresion: pendientes ordenadas por numero, cada cuatro segundos.
CREATE INDEX "pos_order_tickets_status_number_idx" ON "pos_order_tickets"("status", "number");
