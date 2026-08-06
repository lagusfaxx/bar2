import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `prisma db seed` y `prisma migrate reset` usan este comando.
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    // Base descartable que Prisma usa para calcular una migracion nueva. Solo
    // hace falta en desarrollo; el deploy aplica migraciones ya escritas.
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
