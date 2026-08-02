import { prisma } from "@/lib/prisma";

/**
 * Health check para Coolify y para el HEALTHCHECK del contenedor.
 *
 * Comprueba que la app responde y que la base de datos esta accesible: si
 * Postgres se cae, el contenedor debe reportarse como no saludable en lugar de
 * seguir sirviendo errores.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json(
      {
        status: "ok",
        database: "up",
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        status: "error",
        database: "down",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
