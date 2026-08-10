-- CreateEnum
CREATE TYPE "EventAccess" AS ENUM ('SEGUN_EL_DIA', 'PUBLICO', 'PRIVADO');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "access" "EventAccess" NOT NULL DEFAULT 'SEGUN_EL_DIA';
