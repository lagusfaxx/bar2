import { oauthJson, preflight, protectedResourceMetadata } from "@/lib/oauth";

/**
 * Metadatos del recurso protegido (RFC 9728): le dice al conector de Claude
 * donde pedir permiso para usar /api/mcp. Responde tambien en la ruta con
 * sufijo (`/.well-known/oauth-protected-resource/api/mcp`), que es la que se
 * anuncia en la cabecera `WWW-Authenticate`.
 */

export const dynamic = "force-dynamic";

export function GET() {
  return oauthJson(protectedResourceMetadata());
}

export const OPTIONS = preflight;
