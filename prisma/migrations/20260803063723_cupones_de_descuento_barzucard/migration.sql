-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('PENDING', 'REDEEMED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "promotion_vouchers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redemptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promotion_vouchers_code_key" ON "promotion_vouchers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_vouchers_token_key" ON "promotion_vouchers"("token");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_vouchers_redemptionId_key" ON "promotion_vouchers"("redemptionId");

-- CreateIndex
CREATE INDEX "promotion_vouchers_cardId_status_idx" ON "promotion_vouchers"("cardId", "status");

-- CreateIndex
CREATE INDEX "promotion_vouchers_promotionId_idx" ON "promotion_vouchers"("promotionId");

-- AddForeignKey
ALTER TABLE "promotion_vouchers" ADD CONSTRAINT "promotion_vouchers_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_vouchers" ADD CONSTRAINT "promotion_vouchers_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "barzu_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_vouchers" ADD CONSTRAINT "promotion_vouchers_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "redemptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
