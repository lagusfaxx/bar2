-- Secciones enteras fuera de la carta publica.
--
-- Igual que "menu_products"."publicMenu", pero un piso mas arriba: apagada, la
-- seccion y todos sus productos desaparecen de la web (/carta y la portada) y
-- siguen enteros en la carta del QR de la mesa y en el POS. Es lo que hacia
-- falta para algo como los cortos de whisky, donde la lista completa es la que
-- no se anuncia.
--
-- Arranca en `true` para todas: la carta de hoy queda exactamente como esta.
ALTER TABLE "menu_categories"
    ADD COLUMN "publicMenu" BOOLEAN NOT NULL DEFAULT true;
