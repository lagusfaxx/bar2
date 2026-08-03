-- CreateEnum
CREATE TYPE "Station" AS ENUM ('BARRA', 'COCINA');

-- CreateEnum
CREATE TYPE "TableSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('DRAFT', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('PENDING', 'PRINTED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'OTRO');

-- AlterTable
ALTER TABLE "menu_categories" ADD COLUMN     "station" "Station" NOT NULL DEFAULT 'COCINA';

-- AlterTable
ALTER TABLE "menu_products" ADD COLUMN     "promoEndsAt" TIMESTAMP(3),
ADD COLUMN     "promoLabel" TEXT,
ADD COLUMN     "promoPriceCents" INTEGER,
ADD COLUMN     "promoStartsAt" TIMESTAMP(3),
ADD COLUMN     "station" "Station";

-- CreateTable
CREATE TABLE "pos_tables" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT,
    "zone" TEXT,
    "seats" INTEGER NOT NULL DEFAULT 4,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_table_sessions" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "TableSessionStatus" NOT NULL DEFAULT 'OPEN',
    "guests" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "openedById" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "pos_table_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_diners" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_diners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_order_items" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "dinerId" TEXT,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "discountLabel" TEXT,
    "station" "Station" NOT NULL,
    "status" "OrderItemStatus" NOT NULL DEFAULT 'DRAFT',
    "ticketId" TEXT,
    "paymentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_order_tickets" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "station" "Station" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "printedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_order_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_payments" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "dinerId" TEXT,
    "code" TEXT NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'EFECTIVO',
    "cardId" TEXT,
    "cashierId" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pos_tables_number_key" ON "pos_tables"("number");

-- CreateIndex
CREATE INDEX "pos_tables_active_position_idx" ON "pos_tables"("active", "position");

-- CreateIndex
CREATE UNIQUE INDEX "pos_table_sessions_code_key" ON "pos_table_sessions"("code");

-- CreateIndex
CREATE INDEX "pos_table_sessions_status_openedAt_idx" ON "pos_table_sessions"("status", "openedAt");

-- CreateIndex
CREATE INDEX "pos_table_sessions_tableId_status_idx" ON "pos_table_sessions"("tableId", "status");

-- CreateIndex
CREATE INDEX "pos_diners_sessionId_position_idx" ON "pos_diners"("sessionId", "position");

-- CreateIndex
CREATE INDEX "pos_order_items_sessionId_status_idx" ON "pos_order_items"("sessionId", "status");

-- CreateIndex
CREATE INDEX "pos_order_items_dinerId_idx" ON "pos_order_items"("dinerId");

-- CreateIndex
CREATE INDEX "pos_order_items_paymentId_idx" ON "pos_order_items"("paymentId");

-- CreateIndex
CREATE INDEX "pos_order_tickets_status_createdAt_idx" ON "pos_order_tickets"("status", "createdAt");

-- CreateIndex
CREATE INDEX "pos_order_tickets_station_status_idx" ON "pos_order_tickets"("station", "status");

-- CreateIndex
CREATE INDEX "pos_order_tickets_sessionId_idx" ON "pos_order_tickets"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_payments_code_key" ON "pos_payments"("code");

-- CreateIndex
CREATE INDEX "pos_payments_sessionId_idx" ON "pos_payments"("sessionId");

-- CreateIndex
CREATE INDEX "pos_payments_paidAt_idx" ON "pos_payments"("paidAt");

-- CreateIndex
CREATE INDEX "pos_payments_cardId_idx" ON "pos_payments"("cardId");

-- AddForeignKey
ALTER TABLE "pos_table_sessions" ADD CONSTRAINT "pos_table_sessions_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "pos_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_table_sessions" ADD CONSTRAINT "pos_table_sessions_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_diners" ADD CONSTRAINT "pos_diners_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "pos_table_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "pos_table_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_dinerId_fkey" FOREIGN KEY ("dinerId") REFERENCES "pos_diners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "menu_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "pos_order_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "pos_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_tickets" ADD CONSTRAINT "pos_order_tickets_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "pos_table_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_tickets" ADD CONSTRAINT "pos_order_tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "pos_table_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_dinerId_fkey" FOREIGN KEY ("dinerId") REFERENCES "pos_diners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "barzu_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- Ruteo inicial de la carta real: todo lo que se sirve en la barra.
-- El resto queda en COCINA por defecto y se ajusta desde el panel.
UPDATE "menu_categories" SET "station" = 'BARRA'
WHERE "slug" IN (
  'cortos-de-whisky',
  'combinados-de-pisco',
  'gin',
  'promos-de-la-barra',
  'cocteleria',
  'cervezas',
  'vinos',
  'sin-alcohol',
  'bebidas-y-jugos'
);
