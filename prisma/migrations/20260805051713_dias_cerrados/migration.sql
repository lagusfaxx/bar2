-- CreateTable
CREATE TABLE "closed_days" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'Evento privado',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closed_days_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "closed_days_date_key" ON "closed_days"("date");

-- CreateIndex
CREATE INDEX "closed_days_date_idx" ON "closed_days"("date");

-- AddForeignKey
ALTER TABLE "closed_days" ADD CONSTRAINT "closed_days_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
