-- La carta se parte en dos.
--
-- Hasta ahora habia una sola lista de categorias: la web la mostraba sin
-- precios y el QR de la mesa y el POS la mostraban con precios. Pero la carta
-- impresa del local no es la vitrina de la web: trae las variantes que la sala
-- necesita cobrar (chelada, michelada, copa de vino, promos de dos cortos) y la
-- web no tiene por que llenarse de ellas.
--
-- "audience" dice quien ve cada categoria. Las que ya existen quedan en AMBAS,
-- que es exactamente el comportamiento anterior: nada cambia hasta que alguien
-- marque una categoria como WEB o como SALA.
CREATE TYPE "MenuAudience" AS ENUM ('AMBAS', 'WEB', 'SALA');

ALTER TABLE "menu_categories"
    ADD COLUMN "audience" "MenuAudience" NOT NULL DEFAULT 'AMBAS';

CREATE INDEX "menu_categories_audience_active_position_idx"
    ON "menu_categories"("audience", "active", "position");
