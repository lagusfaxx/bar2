-- BarzuCard: el beneficio deja de ser un comprobante y pasa a la cuenta.
--
-- Se van los puntos y los niveles (nadie los entendia y no movian una venta) y
-- entra el alcance de la promocion: sobre que producto, categoria o cuenta
-- aplica. Con eso el POS puede resolver solo cuanto descontar, que es lo que
-- antes quedaba a mano.
--
-- Las promociones de tipo OTHER no tenian ninguna logica asociada; se pasan a
-- descuento porcentual antes de sacar el valor del enum.
UPDATE "promotions" SET "type" = 'PERCENT_OFF' WHERE "type" = 'OTHER';

-- CreateEnum
CREATE TYPE "PromotionScope" AS ENUM ('CUENTA', 'CATEGORIA', 'PRODUCTO');

-- AlterEnum
BEGIN;
CREATE TYPE "PromotionType_new" AS ENUM ('PERCENT_OFF', 'AMOUNT_OFF', 'TWO_FOR_ONE', 'FREE_ITEM');
ALTER TABLE "public"."promotions" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "promotions" ALTER COLUMN "type" TYPE "PromotionType_new" USING ("type"::text::"PromotionType_new");
ALTER TYPE "PromotionType" RENAME TO "PromotionType_old";
ALTER TYPE "PromotionType_new" RENAME TO "PromotionType";
DROP TYPE "public"."PromotionType_old";
ALTER TABLE "promotions" ALTER COLUMN "type" SET DEFAULT 'PERCENT_OFF';
COMMIT;

-- AlterTable
ALTER TABLE "barzu_cards" DROP COLUMN "points",
DROP COLUMN "tier";

-- AlterTable
ALTER TABLE "pos_order_items" ADD COLUMN     "courtesy" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "pos_table_sessions" ADD COLUMN     "cardId" TEXT;

-- AlterTable
ALTER TABLE "promotions" DROP COLUMN "minTier",
DROP COLUMN "pointsCost",
DROP COLUMN "pointsReward",
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "scope" "PromotionScope" NOT NULL DEFAULT 'CUENTA';

-- AlterTable
ALTER TABLE "redemptions" DROP COLUMN "pointsEarned",
DROP COLUMN "pointsSpent",
ADD COLUMN     "dinerId" TEXT,
ADD COLUMN     "discountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- DropEnum
DROP TYPE "CardTier";

-- CreateIndex
CREATE INDEX "pos_table_sessions_cardId_idx" ON "pos_table_sessions"("cardId");

-- CreateIndex
CREATE INDEX "promotions_productId_idx" ON "promotions"("productId");

-- CreateIndex
CREATE INDEX "promotions_categoryId_idx" ON "promotions"("categoryId");

-- CreateIndex
CREATE INDEX "redemptions_sessionId_idx" ON "redemptions"("sessionId");

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "menu_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "menu_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "pos_table_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_dinerId_fkey" FOREIGN KEY ("dinerId") REFERENCES "pos_diners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_table_sessions" ADD CONSTRAINT "pos_table_sessions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "barzu_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

