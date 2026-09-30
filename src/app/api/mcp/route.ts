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
  paymentsDetail,
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
const meta = z.number().positive().optional();

const dailyArgs = z.object({ fecha: fecha.optional(), top, meta });
const monthlyArgs = z.object({ mes: mes.optional(), top, meta });
const rangeArgs = z
  .object({ desde: fecha, hasta: fecha, top, meta })
  .refine((v) => v.desde <= v.hasta, "`desde` no puede ser posterior a `hasta`.")
  .refine(
    (v) => Date.parse(v.hasta) - Date.parse(v.desde) <= 366 * 86400000,
    "El rango no puede superar un año.",
  );
const detailArgs = z.object({ fecha: fecha.optional() });

const topSchema = {
  type: "integer",
  minimum: 1,
  maximum: 100,
  description: "Cuántos productos listar en los rankings.",
};

const metaSchema = {
  type: "number",
  description: "Meta de venta del periodo en pesos, si el usuario la menciona: agrega el % de cumplimiento y lo que falta.",
};

/** Lo que trae cada informe, para que el modelo sepa que puede pedir. */
const CONTENIDO =
  "Trae: resumen (venta total, neta sin IVA, IVA, descuentos, cobros, cuentas, personas, ticket por cobro/cuenta/persona, " +
  "unidades por persona, margen bruto), costos y margen (pour cost de barra, food cost de cocina), descuentos (promos de la carta, " +
  "beneficios BarzuCard, cortesías), formas de pago, tipo de cuenta (mesa/de pie/venta directa), cajeros, garzones, estaciones, " +
  "categorías, productos (más vendidos, mayor facturación, menos vendidos, opciones elegidas, análisis ABC, ingeniería de menú, " +
  "productos de la carta sin ventas), salón (rotación, permanencia, zonas, mesas), tiempos de servicio de barra y cocina, " +
  "cancelaciones (y las que ya habían salido a preparación), cobros anulados, BarzuCard (venta con tarjeta, ticket con vs sin, " +
  "socios nuevos, canjes por promoción, cupones), karaoke, `criterios` y `noDisponible`.";

const TOOLS = [
  {
    name: "informe_diario",
    title: "Informe completo del día",
    description:
      "Informe completo de una jornada del bar (de 6:00 a 6:00 del día siguiente, hora de Chile). " +
      CONTENIDO +
      " Además: venta hora por hora y hora peak, eventos de la noche, cuentas abiertas si es la jornada en curso, " +
      "y comparación con el mismo día de la semana anterior y con el promedio de las últimas 4 semanas.",
    inputSchema: {
      type: "object",
      properties: {
        fecha: {
          type: "string",
          description:
            "Jornada AAAA-MM-DD. Lo cobrado de madrugada cuenta en la noche anterior. Por defecto, la jornada en curso.",
        },
        top: topSchema,
        meta: metaSchema,
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (args: unknown) => {
      const { fecha, top, meta } = dailyArgs.parse(args ?? {});
      return dailyReport(fecha ?? currentJornada(), { top, meta });
    },
  },
  {
    name: "informe_mensual",
    title: "Informe completo del mes",
    description:
      "Informe completo de un mes (por jornadas). " +
      CONTENIDO +
      " Además: venta jornada por jornada (con eventos y días cerrados), promedio por día de la semana, venta por hora, " +
      "mapa de calor día×hora, impacto de los eventos (jornadas con show vs sin show), mejor y peor jornada, " +
      "proyección de cierre si el mes está en curso, y comparación con el mes anterior y con el mismo mes del año anterior.",
    inputSchema: {
      type: "object",
      properties: {
        mes: { type: "string", description: "Mes AAAA-MM. Por defecto, el mes en curso." },
        top: topSchema,
        meta: metaSchema,
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (args: unknown) => {
      const { mes, top, meta } = monthlyArgs.parse(args ?? {});
      return monthlyReport(mes ?? currentMonth(), { top, meta });
    },
  },
  {
    name: "informe_rango",
    title: "Informe completo entre dos fechas",
    description:
      "Informe completo entre dos jornadas (ambas incluidas), para semanas, quincenas o tramos a medida. Máximo un año. " +
      CONTENIDO +
      " Además: venta jornada por jornada, promedio por día de la semana, mapa de calor, impacto de eventos y " +
      "comparación con el tramo anterior del mismo largo.",
    inputSchema: {
      type: "object",
      properties: {
        desde: { type: "string", description: "Primera jornada, AAAA-MM-DD." },
        hasta: { type: "string", description: "Última jornada, AAAA-MM-DD." },
        top: topSchema,
        meta: metaSchema,
      },
      required: ["desde", "hasta"],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (args: unknown) => {
      const { desde, hasta, top, meta } = rangeArgs.parse(args ?? {});
      return rangeReport(desde, hasta, { top, meta });
    },
  },
  {
    name: "detalle_cobros",
    title: "Detalle de cobros de una jornada",
    description:
      "Cada cobro de una jornada, uno por uno: hora, comprobante, cuenta, comensal, forma de pago, subtotal, descuento, " +
      "total, cajero, si usó BarzuCard, si fue anulado y los productos cobrados. Para cuadrar la caja o revisar un reclamo.",
    inputSchema: {
      type: "object",
      properties: {
        fecha: { type: "string", description: "Jornada AAAA-MM-DD. Por defecto, la jornada en curso." },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (args: unknown) => {
      const { fecha } = detailArgs.parse(args ?? {});
      return paymentsDetail(fecha ?? currentJornada());
    },
  },
];

/**
 * Plantillas para pedir el informe con un toque desde Claude. Dicen como
 * presentarlo: el orden en que un dueño de bar lee sus numeros.
 */
const ESTRUCTURA =
  "Arma un informe ejecutivo completo en español, con este orden: " +
  "1) Resumen en 3–5 frases con lo más importante y la comparación. " +
  "2) Indicadores clave en una tabla: venta total, venta neta sin IVA, personas, ticket por persona, ticket por cuenta, cobros, " +
  "descuentos, margen bruto, pour cost y food cost (si hay costos). " +
  "3) Evolución en el tiempo (por hora o por día, con gráfico si puedes) y hora/día peak. " +
  "4) Mix de venta: formas de pago, tipo de cuenta, barra vs cocina, categorías. " +
  "5) Productos: top, ABC, ingeniería de menú con recomendaciones por cuadrante, productos sin ventas. " +
  "6) Equipo: garzones y cajeros. 7) Operación: tiempos de barra y cocina, cancelaciones, anulados. " +
  "8) Salón: rotación, permanencia, zonas. 9) BarzuCard y promociones. 10) Eventos y karaoke. " +
  "11) Alertas y 3–5 recomendaciones concretas. " +
  "Cita los `criterios` cuando expliques una cifra y aclara lo que está en `noDisponible` en vez de inventarlo. " +
  "Si `enCurso` es true, dilo: el periodo no terminó.";

const PROMPTS = [
  {
    name: "informe_del_dia",
    title: "Informe completo del día",
    description: "Informe ejecutivo de una jornada con todos los indicadores.",
    arguments: [
      { name: "fecha", description: "AAAA-MM-DD (vacío = hoy)", required: false },
      { name: "meta", description: "Meta de venta en pesos (opcional)", required: false },
    ],
    text: (a: Record<string, string>) =>
      `Usa la herramienta informe_diario${a.fecha ? ` con fecha ${a.fecha}` : " para la jornada en curso"}` +
      `${a.meta ? ` y meta ${a.meta}` : ""}. ${ESTRUCTURA}`,
  },
  {
    name: "informe_del_mes",
    title: "Informe completo del mes",
    description: "Informe ejecutivo mensual con tendencias, proyección y recomendaciones.",
    arguments: [
      { name: "mes", description: "AAAA-MM (vacío = mes en curso)", required: false },
      { name: "meta", description: "Meta de venta en pesos (opcional)", required: false },
    ],
    text: (a: Record<string, string>) =>
      `Usa la herramienta informe_mensual${a.mes ? ` con mes ${a.mes}` : " para el mes en curso"}` +
      `${a.meta ? ` y meta ${a.meta}` : ""}. Incluye además el mapa de calor, el impacto de los eventos y la proyección. ${ESTRUCTURA}`,
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
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { name: "barzuo-ventas", title: "BARZUO · Ventas", version: "2.0.0" },
        instructions:
          "Informes de ventas del POS de BARZUO, un bar de música en vivo. Usa informe_diario para una " +
          "jornada, informe_mensual para un mes, informe_rango para semanas o tramos y detalle_cobros " +
          "para ver cobro por cobro. Cuando pidan «el informe», entrégalo completo. " + ESTRUCTURA,
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

    case "prompts/list":
      return rpcResult(id, {
        prompts: PROMPTS.map((prompt) => ({
          name: prompt.name,
          title: prompt.title,
          description: prompt.description,
          arguments: prompt.arguments,
        })),
      });

    case "prompts/get": {
      const prompt = PROMPTS.find((p) => p.name === params?.name);
      if (!prompt) return rpcError(id, -32602, `Plantilla desconocida: ${String(params?.name)}`);
      const args = (params?.arguments ?? {}) as Record<string, string>;
      return rpcResult(id, {
        description: prompt.description,
        messages: [{ role: "user", content: { type: "text", text: prompt.text(args) } }],
      });
    }

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
