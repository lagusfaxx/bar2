import {
  authenticateClient,
  oauthJson,
  preflight,
  readForm,
  revokeToken,
} from "@/lib/oauth";

/** Revocacion (RFC 7009): responde 200 aunque la llave no exista. */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await readForm(request);

  const client = await authenticateClient(request, form);
  if (!client) return oauthJson({ error: "invalid_client" }, 401);

  const value = form.get("token");
  if (value) await revokeToken(client, value);

  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export const OPTIONS = preflight;
