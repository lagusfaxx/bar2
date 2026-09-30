import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import {
  CORS_HEADERS,
  OAUTH_SCOPE,
  preflight,
  resourceMetadataUrl,
  verifyAccessToken,
} from "@/lib/oauth";
import {
  currentJornada,
  currentMonth,
  dailyReport,
  monthlyReport,
  rangeReport,
} from "@/lib/sales-report";

/**
 * Servidor MCP de informes de ventas, para conectarlo a Claude.
 *
 * Con esto se le pide a Claude "el informe de ayer" o "como nos fue en
 * septiembre" y lo arma con las cifras de la caja, sin entrar al panel. Es de
 * solo lectura: no hay ninguna herramienta que cambie datos.
 *
 * Habla el transporte "Streamable HTTP" del protocolo en su forma mas simple:
 * sin sesiones y sin streaming. Cada POST trae un mensaje JSON-RPC y recibe su
 * respuesta en JSON. Alcanza de sobra para herramientas que solo leen, y evita
 * guardar estado en el proceso —que se pierde con cada despliegue—.
 *
 * Acceso, por cualquiera de dos vias:
 * - OAuth (lo normal en Claude): sin llave, la ruta responde 401 con la
 *   cabecera que lleva al conector a /oauth/authorize, donde un administrador
 *   da el permiso con su cuenta del panel (ver lib/oauth.ts).
 * - La clave fija `MCP_TOKEN`, como `Authorization: Bearer <token>` o
 *   `?token=<token>`. Opcional: sin la variable esta via queda cerrada.
 */

export const dynamic = "force-dynamic";

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_PROTOCOL = "2025-06-18";

/** La clave fija de `MCP_TOKEN`, para clientes que la mandan tal cual. */
function staticToken(provided: string) {
  const expected = process.env.MCP_TOKEN;

  // Son las cifras del negocio: sin una clave larga, esta via queda cerrada.
  if (!expected || expected.length < 24 || !provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

async function authorized(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (bearer) {
    if (staticToken(bearer)) return true;
    return (await verifyAccessToken(bearer)) !== null;
  }

  return staticToken(new URL(request.url).searchParams.get("token") ?? "");
}

/**
 * La respuesta que arranca el flujo de OAuth: el conector lee la cabecera,
 * encuentra los metadatos y manda a quien lo agrega a autorizar.
 */
function unauthorized() {
  return Response.json(rpcError(null, -32001, "No autorizado"), {
    status: 401,
    headers: {
      ...CORS_HEADERS,
      "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl()}", scope="${OAUTH_SCOPE}"`,
    },
  });
}

// --- Herramientas ------------------------------------------------------------

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD.")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Fecha inválida.");

const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Usa el formato AAAA-MM.");

const top = z.number().int().min(1).max(100).optional();

const dailyArgs = z.object({ fecha: fecha.optional(), top });
const monthlyArgs = z.object({ mes: mes.optional(), top });
const rangeArgs = z
  .object({ desde: fecha, hasta: fecha, top })
  .refine((v) => v.desde <= v.hasta, "`desde` no puede ser posterior a `hasta`.")
  .refine(
    (v) => Date.parse(v.hasta) - Date.parse(v.desde) <= 366 * 86400000,
    "El rango no puede superar un año.",
  );

const topSchema = {
  type: "integer",
  minimum: 1,
  maximum: 100,
  description: "Cuántos productos listar en los rankings.",
};

const TOOLS = [
  {
    name: "informe_diario",
    title: "Informe de ventas del día",
    description:
      "Ventas de una jornada del bar (de 6:00 a 6:00 del día siguiente, hora de Chile): total, " +
      "descuentos, ticket promedio, formas de pago, mesa/de pie/venta directa, cajeros, barra vs cocina, " +
      "productos más vendidos, venta por hora, cobros anulados y comparación con el mismo día de la " +
      "semana anterior. Si es la jornada en curso incluye lo pendiente en cuentas abiertas.",
    inputSchema: {
      type: "object",
      properties: {
        fecha: {
          type: "string",
          description:
            "Jornada AAAA-MM-DD. Lo cobrado de madrugada cuenta en la noche anterior. Por defecto, la jornada en curso.",
        },
        top: topSchema,
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (args: unknown) => {
      const { fecha, top } = dailyArgs.parse(args ?? {});
      return dailyReport(fecha ?? currentJornada(), top);
    },
  },
  {
    name: "informe_mensual",
    title: "Informe de ventas del mes",
    description:
      "Ventas de un mes completo (por jornadas): total, descuentos, ticket promedio, formas de pago, " +
      "tipos de cuenta, cajeros, barra vs cocina, productos más vendidos, venta jornada por jornada, " +
      "promedio por día de la semana, mejor y peor jornada, anulados y comparación con el mes anterior.",
    inputSchema: {
      type: "object",
      properties: {
        mes: { type: "string", description: "Mes AAAA-MM. Por defecto, el mes en curso." },
        top: topSchema,
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (args: unknown) => {
      const { mes, top } = monthlyArgs.parse(args ?? {});
      return monthlyReport(mes ?? currentMonth(), top);
    },
  },
  {
    name: "informe_rango",
    title: "Ventas entre dos fechas",
    description:
      "Ventas entre dos jornadas (ambas incluidas), para semanas o tramos a medida: las mismas cifras " +
      "del informe diario más el total de cada jornada. Máximo un año.",
    inputSchema: {
      type: "object",
      properties: {
        desde: { type: "string", description: "Primera jornada, AAAA-MM-DD." },
        hasta: { type: "string", description: "Última jornada, AAAA-MM-DD." },
        top: topSchema,
      },
      required: ["desde", "hasta"],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (args: unknown) => {
      const { desde, hasta, top } = rangeArgs.parse(args ?? {});
      return rangeReport(desde, hasta, top);
    },
  },
];

// --- JSON-RPC ----------------------------------------------------------------

type RpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

const rpcResult = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });

const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

async function handle(message: RpcRequest) {
  const { id, method, params } = message;

  switch (method) {
    case "initialize": {
      const requested = String(params?.protocolVersion ?? "");
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "barzuo-ventas", title: "BARZUO · Ventas", version: "1.0.0" },
        instructions:
          "Informes de ventas del POS de BARZUO. Usa informe_diario para una jornada, " +
          "informe_mensual para un mes e informe_rango para semanas o tramos. Cada respuesta trae " +
          "sus `criterios`: cítalos al explicar una cifra. Si `enCurso` es true el periodo no ha " +
          "terminado y la comparación es hasta la misma hora del periodo anterior.",
      });
    }

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, {
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
        })),
      });

    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return rpcError(id, -32602, `Herramienta desconocida: ${String(params?.name)}`);

      try {
        const data = await tool.run(params?.arguments);
        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          structuredContent: data,
        });
      } catch (error) {
        // Los errores de la herramienta vuelven como resultado, para que el
        // modelo los lea y corrija la llamada.
        const text =
          error instanceof z.ZodError
            ? error.issues.map((issue) => issue.message).join(" ")
            : "No se pudo armar el informe.";

        if (!(error instanceof z.ZodError)) console.error("[mcp]", error);

        return rpcResult(id, { content: [{ type: "text", text }], isError: true });
      }
    }

    default:
      return rpcError(id, -32601, `Método no soportado: ${method}`);
  }
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(rpcError(null, -32700, "JSON inválido"), { status: 400 });
  }

  const messages = (Array.isArray(body) ? body : [body]) as RpcRequest[];

  const responses = [];
  for (const message of messages) {
    if (!message || typeof message !== "object" || typeof message.method !== "string") {
      responses.push(rpcError(null, -32600, "Solicitud inválida"));
      continue;
    }

    // Las notificaciones (sin id) no llevan respuesta.
    if (message.id === undefined) continue;

    responses.push(await handle(message));
  }

  if (responses.length === 0) return new Response(null, { status: 202, headers: CORS_HEADERS });

  return Response.json(Array.isArray(body) ? responses : responses[0], {
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
  });
}

/** Sin streaming del servidor al cliente: el protocolo pide 405 en ese caso. */
export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export const OPTIONS = preflight;
