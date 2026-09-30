import { headers } from "next/headers";
import { z } from "zod";

import { oauthJson, preflight, registerClient, validRedirectUri } from "@/lib/oauth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Registro dinamico de clientes (RFC 7591).
 *
 * Abierto a proposito —asi se agrega el conector sin copiar claves—, porque
 * registrarse no da acceso a nada: la llave la entrega solo un administrador
 * desde la pantalla de autorizacion. El limite por IP es para que nadie llene
 * la tabla.
 */

export const dynamic = "force-dynamic";

const schema = z.object({
  redirect_uris: z.array(z.string()).min(1).max(10),
  client_name: z.string().trim().max(120).optional(),
  token_endpoint_auth_method: z
    .enum(["none", "client_secret_post", "client_secret_basic"])
    .optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`oauth-register:${ip}`, 20, 3600).ok) {
    return oauthJson({ error: "too_many_requests" }, 429);
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return oauthJson(
      { error: "invalid_client_metadata", error_description: "Metadatos inválidos." },
      400,
    );
  }

  const data = parsed.data;

  if (!data.redirect_uris.every(validRedirectUri)) {
    return oauthJson(
      {
        error: "invalid_redirect_uri",
        error_description: "Las direcciones de retorno deben ser https o de localhost.",
      },
      400,
    );
  }

  const grants = data.grant_types ?? ["authorization_code"];
  if (grants.some((g) => g !== "authorization_code" && g !== "refresh_token")) {
    return oauthJson({ error: "invalid_client_metadata", error_description: "grant_types no soportado." }, 400);
  }

  const method = data.token_endpoint_auth_method ?? "none";

  const { client, secret } = await registerClient({
    name: data.client_name || "Aplicación sin nombre",
    redirectUris: data.redirect_uris,
    withSecret: method !== "none",
  });

  return oauthJson(
    {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: method,
    },
    201,
  );
}

export const OPTIONS = preflight;
