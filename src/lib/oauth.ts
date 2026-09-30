import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/utils";

/**
 * OAuth 2.1 para el servidor MCP de ventas.
 *
 * Es lo que pide Claude para agregar un conector sin pegar claves en la URL:
 * el conector descubre como autenticarse (`/.well-known/...`), se registra solo,
 * manda a quien lo agrega a la pantalla de autorizacion del panel —que usa el
 * mismo login de siempre— y recibe llaves que se renuevan solas.
 *
 * Solo lo justo para eso: flujo de codigo con PKCE (S256), renovacion con
 * rotacion y revocacion. Nada de OpenID ni de otros flujos.
 *
 * Quien autoriza tiene que ser ADMIN, y tiene que seguir siendolo: cada
 * llamada al MCP vuelve a mirar la cuenta, asi que desactivar a alguien o
 * bajarle el rol corta sus conexiones en el acto.
 */

export const OAUTH_SCOPE = "ventas:leer";

const CODE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TTL_S = 60 * 60;
const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000;

export const issuer = () => absoluteUrl("/").replace(/\/$/, "");
export const mcpResource = () => absoluteUrl("/api/mcp");
export const resourceMetadataUrl = () =>
  absoluteUrl("/.well-known/oauth-protected-resource/api/mcp");

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const token = (prefix: string) => `${prefix}_${randomBytes(32).toString("base64url")}`;

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// --- Metadatos ---------------------------------------------------------------

export function authorizationServerMetadata() {
  const base = issuer();

  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: [OAUTH_SCOPE],
    authorization_response_iss_parameter_supported: true,
  };
}

export function protectedResourceMetadata() {
  return {
    resource: mcpResource(),
    authorization_servers: [issuer()],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "BARZUO · Ventas",
  };
}

// --- Clientes ----------------------------------------------------------------

/**
 * A donde se puede mandar el codigo.
 *
 * HTTPS siempre; HTTP solo hacia el propio equipo, que es como recibe el
 * codigo una aplicacion de escritorio o de terminal (Claude Code). Nunca un
 * fragmento: el codigo tiene que llegar en la consulta.
 */
export function validRedirectUri(uri: string) {
  try {
    const url = new URL(uri);
    if (url.hash) return false;
    if (url.protocol === "https:") return true;
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export async function registerClient(input: {
  name: string;
  redirectUris: string[];
  withSecret: boolean;
}) {
  const clientId = token("bzc");
  const secret = input.withSecret ? token("bzs") : null;

  const client = await prisma.oAuthClient.create({
    data: {
      clientId,
      name: input.name,
      redirectUris: input.redirectUris,
      secretHash: secret ? hash(secret) : null,
    },
  });

  return { client, secret };
}

export function findClient(clientId: string) {
  return prisma.oAuthClient.findUnique({ where: { clientId } });
}

/**
 * Autenticacion del cliente en /oauth/token y /oauth/revoke.
 *
 * Un cliente publico (sin secreto) se identifica solo con su `client_id`: lo
 * que lo protege es PKCE. Uno con secreto tiene que mandarlo, por el cuerpo o
 * por Basic.
 */
export async function authenticateClient(request: Request, form: URLSearchParams) {
  let clientId = form.get("client_id");
  let secret = form.get("client_secret");

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString();
    const sep = decoded.indexOf(":");
    if (sep > 0) {
      clientId = decodeURIComponent(decoded.slice(0, sep));
      secret = decodeURIComponent(decoded.slice(sep + 1));
    }
  }

  if (!clientId) return null;

  const client = await findClient(clientId);
  if (!client) return null;

  if (client.secretHash) {
    if (!secret || !safeEqual(hash(secret), client.secretHash)) return null;
  }

  return client;
}

// --- Autorizacion ------------------------------------------------------------

export type AuthorizeParams = {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  state?: string;
  scope?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  resource?: string;
};

export type AuthorizeCheck =
  /** No hay a quien devolverle el error: se muestra en pantalla. */
  | { ok: false; fatal: true; message: string }
  /** Se le devuelve el error al cliente por su redirect_uri. */
  | { ok: false; fatal: false; redirect: string }
  | {
      ok: true;
      client: { id: string; name: string; clientId: string };
      redirectUri: string;
      codeChallenge: string;
      resource: string | null;
      scope: string;
      state: string | null;
    };

export function errorRedirect(redirectUri: string, error: string, state?: string | null, description?: string) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (description) url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  url.searchParams.set("iss", issuer());
  return url.toString();
}

/**
 * Revisa una peticion de autorizacion antes de mostrar nada.
 *
 * Primero el cliente y su redirect_uri: hasta confirmar que la direccion es
 * una que el cliente registro, no se redirige a ningun lado —seria un
 * redirector abierto—. Recien despues, el resto de los errores vuelven al
 * cliente como manda el protocolo.
 */
export async function checkAuthorizeRequest(params: AuthorizeParams): Promise<AuthorizeCheck> {
  if (!params.client_id) {
    return { ok: false, fatal: true, message: "Falta el identificador de la aplicación." };
  }

  const client = await findClient(params.client_id);
  if (!client) {
    return { ok: false, fatal: true, message: "Esta aplicación no está registrada. Vuelve a agregar el conector." };
  }

  const redirectUri =
    params.redirect_uri ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : undefined);

  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return { ok: false, fatal: true, message: "La dirección de retorno no coincide con la registrada." };
  }

  const state = params.state ?? null;
  const fail = (error: string, description: string) => ({
    ok: false as const,
    fatal: false as const,
    redirect: errorRedirect(redirectUri, error, state, description),
  });

  if (params.response_type !== "code") {
    return fail("unsupported_response_type", "Solo se admite response_type=code.");
  }

  if (!params.code_challenge || params.code_challenge_method !== "S256") {
    return fail("invalid_request", "Se requiere PKCE con S256.");
  }

  if (!/^[A-Za-z0-9_-]{43,128}$/.test(params.code_challenge)) {
    return fail("invalid_request", "code_challenge inválido.");
  }

  // El recurso, si viene, tiene que ser este servidor: un codigo emitido para
  // otro servicio no debe servir aca, ni al reves.
  if (params.resource && params.resource.replace(/\/$/, "") !== mcpResource()) {
    return fail("invalid_target", "Recurso desconocido.");
  }

  const requested = (params.scope ?? "").split(" ").filter(Boolean);
  if (requested.some((s) => s !== OAUTH_SCOPE)) {
    return fail("invalid_scope", `El único permiso disponible es ${OAUTH_SCOPE}.`);
  }

  return {
    ok: true,
    client: { id: client.id, name: client.name, clientId: client.clientId },
    redirectUri,
    codeChallenge: params.code_challenge,
    resource: params.resource ?? null,
    scope: OAUTH_SCOPE,
    state,
  };
}

export async function issueCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string | null;
  scope: string;
}) {
  const code = token("bzcode");

  await prisma.oAuthCode.create({
    data: {
      ...input,
      codeHash: hash(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  // Limpieza de paso: los codigos viejos no sirven para nada.
  await prisma.oAuthCode.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  return code;
}

// --- Llaves ------------------------------------------------------------------

export class OAuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function tokenResponse(access: string, refresh: string, scope: string) {
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_S,
    refresh_token: refresh,
    scope,
  };
}

async function activeAdmin(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { active: true, role: true },
  });
  return !!user?.active && user.role === "ADMIN";
}

export async function exchangeCode(
  client: { id: string },
  form: URLSearchParams,
) {
  const code = form.get("code");
  const verifier = form.get("code_verifier");
  const redirectUri = form.get("redirect_uri");

  if (!code || !verifier) throw new OAuthError("invalid_request", "Faltan code o code_verifier.");

  const grant = await prisma.oAuthCode.findUnique({ where: { codeHash: hash(code) } });

  if (!grant || grant.clientId !== client.id || grant.expiresAt < new Date()) {
    throw new OAuthError("invalid_grant", "Código inválido o vencido.");
  }

  // Un codigo usado dos veces es señal de que alguien lo intercepto: se
  // corta todo lo que ese codigo haya emitido.
  if (grant.usedAt) {
    await prisma.oAuthToken.updateMany({
      where: { clientId: client.id, userId: grant.userId, createdAt: { gte: grant.createdAt }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new OAuthError("invalid_grant", "Código ya usado.");
  }

  if (redirectUri && redirectUri !== grant.redirectUri) {
    throw new OAuthError("invalid_grant", "redirect_uri no coincide.");
  }

  const challenge = createHash("sha256").update(verifier).digest("base64url");
  if (!safeEqual(challenge, grant.codeChallenge)) {
    throw new OAuthError("invalid_grant", "code_verifier no coincide.");
  }

  const resource = form.get("resource");
  if (resource && resource.replace(/\/$/, "") !== mcpResource()) {
    throw new OAuthError("invalid_target", "Recurso desconocido.");
  }

  // Marcar usado de forma atomica: dos canjes simultaneos, solo uno gana.
  const { count } = await prisma.oAuthCode.updateMany({
    where: { id: grant.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (count !== 1) throw new OAuthError("invalid_grant", "Código ya usado.");

  if (!(await activeAdmin(grant.userId))) {
    throw new OAuthError("invalid_grant", "La cuenta que autorizó ya no tiene acceso.");
  }

  const access = token("bzat");
  const refresh = token("bzrt");

  await prisma.oAuthToken.create({
    data: {
      clientId: client.id,
      userId: grant.userId,
      scope: grant.scope,
      accessHash: hash(access),
      accessExpiresAt: new Date(Date.now() + ACCESS_TTL_S * 1000),
      refreshHash: hash(refresh),
      refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  return tokenResponse(access, refresh, grant.scope);
}

export async function refreshTokens(client: { id: string }, form: URLSearchParams) {
  const refresh = form.get("refresh_token");
  if (!refresh) throw new OAuthError("invalid_request", "Falta refresh_token.");

  const current = await prisma.oAuthToken.findUnique({ where: { refreshHash: hash(refresh) } });

  if (
    !current ||
    current.clientId !== client.id ||
    current.revokedAt ||
    current.refreshExpiresAt < new Date()
  ) {
    throw new OAuthError("invalid_grant", "Llave de renovación inválida o vencida.");
  }

  if (!(await activeAdmin(current.userId))) {
    throw new OAuthError("invalid_grant", "La cuenta que autorizó ya no tiene acceso.");
  }

  const access = token("bzat");
  const next = token("bzrt");

  // Rotacion: la llave de renovacion vieja deja de existir en este mismo paso.
  const { count } = await prisma.oAuthToken.updateMany({
    where: { id: current.id, refreshHash: current.refreshHash, revokedAt: null },
    data: {
      accessHash: hash(access),
      accessExpiresAt: new Date(Date.now() + ACCESS_TTL_S * 1000),
      refreshHash: hash(next),
      refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  if (count !== 1) throw new OAuthError("invalid_grant", "Llave de renovación ya usada.");

  return tokenResponse(access, next, current.scope);
}

export async function revokeToken(client: { id: string }, value: string) {
  const h = hash(value);
  await prisma.oAuthToken.updateMany({
    where: {
      clientId: client.id,
      revokedAt: null,
      OR: [{ accessHash: h }, { refreshHash: h }],
    },
    data: { revokedAt: new Date() },
  });
}

/**
 * La llave de una llamada al MCP: vigente, sin revocar y de un administrador
 * que siga activo.
 */
export async function verifyAccessToken(value: string) {
  if (!value.startsWith("bzat_")) return null;

  const row = await prisma.oAuthToken.findUnique({
    where: { accessHash: hash(value) },
    select: {
      id: true,
      userId: true,
      scope: true,
      revokedAt: true,
      accessExpiresAt: true,
      lastUsedAt: true,
      user: { select: { active: true, role: true } },
    },
  });

  if (!row || row.revokedAt || row.accessExpiresAt < new Date()) return null;
  if (!row.user.active || row.user.role !== "ADMIN") return null;

  // "Ultimo uso" con resolucion de un minuto: no vale una escritura por llamada.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await prisma.oAuthToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  }

  return { userId: row.userId, scope: row.scope };
}

// --- Respuestas HTTP ---------------------------------------------------------

/**
 * Los extremos de OAuth se pueden llamar desde un navegador (el inspector de
 * MCP, clientes web): no leen cookies, asi que abrirlos a cualquier origen no
 * expone nada.
 */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
};

export function oauthJson(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store", ...extra },
  });
}

export const preflight = () => new Response(null, { status: 204, headers: CORS_HEADERS });

/** El cuerpo de /oauth/token y /oauth/revoke: formulario, o JSON por tolerancia. */
export async function readForm(request: Request) {
  const type = request.headers.get("content-type") ?? "";

  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return new URLSearchParams(
      Object.entries(body).map(([k, v]) => [k, String(v)] as [string, string]),
    );
  }

  return new URLSearchParams(await request.text());
}
