import { authorizationServerMetadata, oauthJson, preflight } from "@/lib/oauth";

/** Metadatos del servidor de autorizacion (RFC 8414). */

export const dynamic = "force-dynamic";

export function GET() {
  return oauthJson(authorizationServerMetadata());
}

export const OPTIONS = preflight;
