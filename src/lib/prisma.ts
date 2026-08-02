import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL no esta definida. Copia .env.example a .env y configura la conexion a PostgreSQL.",
    );
  }

  const adapter = new PrismaPg({
    connectionString,
    // Coolify/Docker suelen levantar la app antes que Postgres termine de arrancar.
    connectionTimeoutMillis: 10_000,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
