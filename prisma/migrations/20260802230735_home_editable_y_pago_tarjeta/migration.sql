-- CreateEnum
CREATE TYPE "CardPaymentStatus" AS ENUM ('PENDING', 'REPORTED', 'PAID', 'DELIVERED');

-- AlterTable
ALTER TABLE "barzu_cards" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentReference" TEXT,
ADD COLUMN     "paymentStatus" "CardPaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reportedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "cardPaymentInfo" TEXT,
ADD COLUMN     "cardPickupInfo" TEXT,
ADD COLUMN     "cardPriceCents" INTEGER NOT NULL DEFAULT 550000,
ADD COLUMN     "heroVideoPosterUrl" TEXT,
ADD COLUMN     "homeEventsEyebrow" TEXT DEFAULT 'Cartelera',
ADD COLUMN     "homeEventsLead" TEXT,
ADD COLUMN     "homeEventsTitle" TEXT DEFAULT 'Lo que se viene',
ADD COLUMN     "homeGalleryEyebrow" TEXT DEFAULT 'Galeria',
ADD COLUMN     "homeGalleryLead" TEXT,
ADD COLUMN     "homeGalleryTitle" TEXT DEFAULT 'Noches que quedan',
ADD COLUMN     "homeLocationEyebrow" TEXT DEFAULT 'Ubicacion',
ADD COLUMN     "homeLocationTitle" TEXT DEFAULT 'Te esperamos',
ADD COLUMN     "homeLoyaltyTitle" TEXT DEFAULT 'Tu tarjeta de beneficios',
ADD COLUMN     "homeMenuEyebrow" TEXT DEFAULT 'La carta',
ADD COLUMN     "homeMenuLead" TEXT,
ADD COLUMN     "homeMenuTitle" TEXT DEFAULT 'Para acompanar la noche',
ADD COLUMN     "marqueeText" TEXT;

-- CreateIndex
CREATE INDEX "barzu_cards_paymentStatus_idx" ON "barzu_cards"("paymentStatus");
