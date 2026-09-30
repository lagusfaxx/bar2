import {
  authenticateClient,
  exchangeCode,
  OAuthError,
  oauthJson,
  preflight,
  readForm,
  refreshTokens,
} from "@/lib/oauth";

/** Canje del codigo por llaves, y renovacion de las llaves. */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await readForm(request);

  const client = await authenticateClient(request, form);
  if (!client) {
    return oauthJson(
      { error: "invalid_client", error_description: "Cliente desconocido o mal autenticado." },
      401,
    );
  }

  try {
    switch (form.get("grant_type")) {
      case "authorization_code":
        return oauthJson(await exchangeCode(client, form));
      case "refresh_token":
        return oauthJson(await refreshTokens(client, form));
      default:
        return oauthJson({ error: "unsupported_grant_type" }, 400);
    }
  } catch (error) {
    if (error instanceof OAuthError) {
      return oauthJson({ error: error.code, error_description: error.message }, error.status);
    }
    throw error;
  }
}

export const OPTIONS = preflight;
