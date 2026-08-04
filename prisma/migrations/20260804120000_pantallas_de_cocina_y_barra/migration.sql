-- CreateEnum
CREATE TYPE "PrepStatus" AS ENUM ('NUEVA', 'EN_CURSO', 'LISTA');

-- DropIndex
DROP INDEX "pos_order_tickets_station_status_idx";

-- AlterTable
ALTER TABLE "pos_order_tickets" ADD COLUMN     "prep" "PrepStatus" NOT NULL DEFAULT 'NUEVA',
ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "pos_order_tickets_station_prep_idx" ON "pos_order_tickets"("station", "prep");

