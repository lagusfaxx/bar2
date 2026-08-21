-- Productos que no salen en la carta publica.
--
-- La web (/carta y la portada) es la vitrina: la ve cualquiera. La carta del QR
-- de la mesa (/carta/mesa) y el POS de los garzones son de puertas adentro. Con
-- esta columna un producto puede estar entero en las dos ultimas sin aparecer
-- en la primera.
--
-- Arranca en `true` para todos: la carta de hoy queda exactamente como esta, y
-- se apaga producto por producto desde el panel.
ALTER TABLE "menu_products"
    ADD COLUMN "publicMenu" BOOLEAN NOT NULL DEFAULT true;
