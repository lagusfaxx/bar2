-- CreateEnum
CREATE TYPE "TicketKind" AS ENUM ('COMANDA', 'COBRO');

-- DropIndex
DROP INDEX "pos_order_tickets_station_prep_idx";

-- AlterTable
ALTER TABLE "pos_order_tickets" ADD COLUMN     "kind" "TicketKind" NOT NULL DEFAULT 'COMANDA',
ADD COLUMN     "paymentId" TEXT,
ALTER COLUMN "station" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "pos_order_tickets_kind_station_prep_idx" ON "pos_order_tickets"("kind", "station", "prep");

-- CreateIndex
CREATE INDEX "pos_order_tickets_paymentId_idx" ON "pos_order_tickets"("paymentId");

-- AddForeignKey
ALTER TABLE "pos_order_tickets" ADD CONSTRAINT "pos_order_tickets_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "pos_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
