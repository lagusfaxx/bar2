"use server";

import { redirect } from "next/navigation";

import { getPanelSession } from "@/lib/auth";
import {
  checkAuthorizeRequest,
  errorRedirect,
  issuer,
  issueCode,
  type AuthorizeParams,
} from "@/lib/oauth";

import { recordAudit } from "./admin/audit";

const FIELDS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "state",
  "scope",
  "code_challenge",
  "code_challenge_method",
  "resource",
] as const;

/**
 * La respuesta de la pantalla de autorizacion: permitir o cancelar.
 *
 * Vuelve a revisar todo lo que la pantalla ya reviso: el formulario lo manda
 * el navegador y podria llegar tocado.
 */
export async function decideAuthorization(formData: FormData) {
  const params: AuthorizeParams = {};
  for (const field of FIELDS) {
    const value = formData.get(field);
    if (typeof value === "string" && value !== "") params[field] = value;
  }

  const session = await getPanelSession();
  if (!session) {
    const query = new URLSearchParams(params as Record<string, string>);
    redirect(`/admin/login?volver=${encodeURIComponent(`/oauth/authorize?${query}`)}`);
  }

  const check = await checkAuthorizeRequest(params);
  if (!check.ok) {
    if (check.fatal) redirect("/admin");
    redirect(check.redirect);
  }

  if (session.role !== "ADMIN" || formData.get("decision") !== "allow") {
    redirect(errorRedirect(check.redirectUri, "access_denied", check.state));
  }

  const code = await issueCode({
    clientId: check.client.id,
    userId: session.userId,
    redirectUri: check.redirectUri,
    codeChallenge: check.codeChallenge,
    resource: check.resource,
    scope: check.scope,
  });

  await recordAudit(
    session.userId,
    "create",
    "OAuthClient",
    check.client.id,
    `Conector autorizado: ${check.client.name}`,
  );

  const url = new URL(check.redirectUri);
  url.searchParams.set("code", code);
  if (check.state) url.searchParams.set("state", check.state);
  url.searchParams.set("iss", issuer());

  redirect(url.toString());
}
