-- Dos cosas que el bar necesitaba y la sala resolvia a mano.
--
-- 1. LO QUE HAY QUE PREGUNTAR AL PEDIR
--
-- La promo que viene con bebida no dice cual, y el agua no dice si es con gas.
-- Eso se anotaba en la nota de la linea: teclado en medio del servicio, y la
-- barra recibiendo "coca", "Coca" y "coca cola" para la misma cosa. Ahora el
-- producto declara la pregunta y sus respuestas, y elegir es un toque.
--
-- Una sola pregunta por producto: dos preguntas en una pantalla tactil con
-- gente esperando es un arbol de decisiones, y para eso conviene que sean dos
-- productos.
ALTER TABLE "menu_products"
    ADD COLUMN "optionLabel" TEXT,
    ADD COLUMN "options" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- La respuesta elegida, en la linea. Aparte de "note" porque no es lo mismo:
-- la nota es un pedido del cliente ("sin hielo") y esto es parte de lo que se
-- vendio. Separado se puede imprimir donde se lee y contar despues.
ALTER TABLE "pos_order_items"
    ADD COLUMN "variant" TEXT;

-- 2. LA GENTE QUE NUNCA SE SIENTA
--
-- Toda cuenta colgaba de una mesa, y una mesa no admite dos turnos abiertos a
-- la vez. En un bar con veinte personas de pie en la barra eso obligaba a
-- inventar mesas o a llevar las rondas de memoria.
--
-- "tableId" pasa a ser opcional: una cuenta de pie no pertenece a ninguna. El
-- resto —lineas, comandas, cobro— no cambia en nada.
ALTER TABLE "pos_table_sessions"
    ALTER COLUMN "tableId" DROP NOT NULL;

CREATE TYPE "SessionKind" AS ENUM ('MESA', 'PIE');

-- Todo lo que existe hoy es de mesa: son turnos abiertos o cerrados de gente
-- sentada, y el valor por defecto los deja exactamente como estan.
ALTER TABLE "pos_table_sessions"
    ADD COLUMN "kind" "SessionKind" NOT NULL DEFAULT 'MESA',
    ADD COLUMN "label" TEXT;

-- La pantalla de sala pide las cuentas de pie abiertas por antiguedad en cada
-- vuelta, igual que pide las mesas.
CREATE INDEX "pos_table_sessions_kind_status_openedAt_idx"
    ON "pos_table_sessions"("kind", "status", "openedAt");
