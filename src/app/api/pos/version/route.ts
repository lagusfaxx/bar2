import { verifyPanelToken } from "@/lib/auth";
import { posVersion, type PosScope } from "@/lib/pos-version";

/**
 * "¿Cambio algo?" — la pregunta barata de las pantallas de sala.
 *
 * Devuelve una marca opaca del estado de una pantalla. Mientras sea la misma,
 * la pantalla no tiene nada que rehacer; cuando cambia, se rearma. El porque
 * esta explicado en lib/pos-version.ts.
 *
 * No devuelve ni un dato del local: ni mesas, ni precios, ni nombres. Por eso
 * alcanza con comprobar la firma de la sesion, sin consultar la base.
 */

export const dynamic = "force-dynamic";

function scopeFrom(url: URL): PosScope | null {
  switch (url.searchParams.get("scope")) {
    case "sala":
      return { kind: "sala" };

    case "cuenta": {
      const sessionId = url.searchParams.get("sesion");
      return sessionId ? { kind: "cuenta", sessionId } : null;
    }

    case "estacion": {
      const station = url.searchParams.get("estacion");
      return station === "BARRA" || station === "COCINA"
        ? { kind: "estacion", station }
        : null;
    }

    default:
      return null;
  }
}

export async function GET(request: Request) {
  const session = await verifyPanelToken();

  if (!session) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const scope = scopeFrom(new URL(request.url));

  if (!scope) {
    return Response.json({ error: "Ambito invalido" }, { status: 400 });
  }

  return Response.json(
    { v: await posVersion(scope) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
