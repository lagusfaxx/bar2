import "server-only";

import { Resend } from "resend";

import { getSettings } from "@/lib/content";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/utils";

import type { EmailKind } from "@/generated/prisma/enums";

/**
 * El correo del local.
 *
 * Todo lo que sale por mail pasa por aca: el aviso de un mensaje del
 * formulario, la tarjeta que recibe el socio, el enlace para recuperar la
 * contrasena, el saludo de cumpleanos y las campanas.
 *
 * Dos reglas gobiernan el archivo entero:
 *
 * 1. **Un correo que no sale nunca voltea lo que el usuario estaba haciendo.**
 *    Si Resend se cae, el mensaje de contacto igual queda guardado y el socio
 *    igual queda registrado. El envio se intenta, se anota como fallido y la
 *    pagina sigue. Lo contrario —perder un mensaje de un cliente porque el
 *    proveedor de correo tuvo un mal minuto— es mucho peor que no avisar.
 *
 * 2. **Todo lo enviado queda registrado.** Sin registro, "no me llego el
 *    correo" no se puede responder: no hay forma de saber si se envio, si
 *    reboto o si nunca se intento.
 */

/** Sin clave configurada no se envia nada, y se dice por que. */
function client() {
  const key = process.env.RESEND_API_KEY;

  if (!key) return null;

  return new Resend(key);
}

/**
 * De que direccion sale el correo.
 *
 * Tiene que ser un dominio verificado en Resend. Con el dominio sin verificar
 * el proveedor rechaza el envio, asi que el valor por defecto es a proposito
 * uno que falla ruidoso en vez de uno que parezca funcionar.
 */
function remitente(barName: string) {
  const from = process.env.EMAIL_FROM;

  if (!from) return null;

  // "BARZUO <hola@barzuo.com>": el nombre visible sale de los ajustes, asi que
  // al cambiar el nombre del local cambia tambien el del remitente.
  return from.includes("<") ? from : `${barName} <${from}>`;
}

/**
 * A quien se le avisa de lo que pasa en la web.
 *
 * Sale de los ajustes —el administrador lo cambia sin tocar codigo ni volver a
 * desplegar— y admite varias direcciones separadas por coma, que es el caso
 * del local: el dueno y quien atiende las reservas.
 */
export function destinatariosDeAviso(notifyEmails: string | null): string[] {
  const crudo = notifyEmails ?? process.env.EMAIL_NOTIFY_TO ?? "";

  return crudo
    .split(/[,;\s]+/)
    .map((valor) => valor.trim())
    .filter((valor) => valor.includes("@"));
}

export type EnvioResultado =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

/**
 * Manda un correo y lo deja anotado.
 *
 * `to` puede ser una direccion o varias. Cuando son varias se manda una copia
 * a cada una por separado y no un unico correo con todos en el "para": son
 * casillas de gente distinta y no tienen por que verse entre ellas, ni que
 * responder "a todos" sin querer.
 */
export async function sendEmail({
  to,
  subject,
  html,
  kind,
  memberId = null,
  campaignId = null,
  replyTo,
}: {
  to: string | string[];
  subject: string;
  html: string;
  kind: EmailKind;
  memberId?: string | null;
  campaignId?: string | null;
  replyTo?: string;
}): Promise<EnvioResultado> {
  const destinos = (Array.isArray(to) ? to : [to]).filter(Boolean);

  if (destinos.length === 0) {
    return { ok: false, error: "Sin destinatario." };
  }

  const settings = await getSettings();
  const from = remitente(settings.barName);
  const resend = client();

  /** Anota el intento, pase lo que pase. Nunca lanza. */
  const anotar = async (
    destino: string,
    estado: "SENT" | "FAILED",
    providerId: string | null,
    error: string | null,
  ) => {
    try {
      await prisma.emailLog.create({
        data: {
          to: destino,
          subject: subject.slice(0, 300),
          kind,
          status: estado,
          providerId,
          error: error?.slice(0, 500) ?? null,
          memberId,
          campaignId,
        },
      });
    } catch {
      // El registro es para poder mirar despues: si falla, no puede arrastrar
      // consigo el envio que si funciono.
    }
  };

  if (!resend || !from) {
    const motivo = !resend
      ? "Falta RESEND_API_KEY."
      : "Falta EMAIL_FROM (dominio verificado en Resend).";

    for (const destino of destinos) await anotar(destino, "FAILED", null, motivo);

    return { ok: false, error: motivo };
  }

  let ultimoId: string | null = null;
  let ultimoError: string | null = null;

  for (const destino of destinos) {
    try {
      const { data, error } = await resend.emails.send({
        from,
        to: destino,
        subject,
        html,
        ...(replyTo ? { replyTo } : {}),
      });

      if (error) {
        ultimoError = error.message;
        await anotar(destino, "FAILED", null, error.message);
        continue;
      }

      ultimoId = data?.id ?? null;
      await anotar(destino, "SENT", ultimoId, null);
    } catch (error) {
      ultimoError = error instanceof Error ? error.message : "Error de envio";
      await anotar(destino, "FAILED", null, ultimoError);
    }
  }

  return ultimoError && !ultimoId
    ? { ok: false, error: ultimoError }
    : { ok: true, id: ultimoId };
}

// --- La plantilla ------------------------------------------------------------

/**
 * El armazon de todos los correos.
 *
 * Es HTML de correo, que no es HTML web: se arma con tablas y estilos en linea
 * porque Outlook y Gmail descartan hojas de estilo, `flex` y `grid`. Lo que en
 * la pagina serian tres lineas de Tailwind, aca son tablas anidadas — y es la
 * unica forma de que se vea igual en las dos casillas que importan.
 *
 * Fondo claro a proposito, aunque el sitio sea oscuro: un correo negro se ve
 * roto en los clientes que fuerzan tema claro, y peor todavia al reenviarlo o
 * imprimirlo.
 */
export function emailLayout({
  barName,
  logoUrl,
  titulo,
  cuerpo,
  pie,
}: {
  barName: string;
  logoUrl?: string | null;
  titulo: string;
  /** HTML ya armado del contenido. */
  cuerpo: string;
  /** Linea final, bajo la firma. */
  pie?: string;
}) {
  const logo = logoUrl
    ? `<img src="${absoluteUrl(logoUrl)}" alt="${escapeHtml(barName)}" width="120" style="display:block;margin:0 auto;max-width:120px;height:auto;border:0;">`
    : `<div style="font:700 26px/1.2 Georgia,'Times New Roman',serif;color:#f4efe7;letter-spacing:.06em;">${escapeHtml(barName)}</div>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:#f2efe9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2efe9;">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:4px;overflow:hidden;">
        <tr>
          <td align="center" style="background:#08070a;padding:26px 24px;border-bottom:3px solid #b4111b;">
            ${logo}
          </td>
        </tr>
        <tr>
          <td style="padding:32px 28px;font:400 16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#232025;">
            <h1 style="margin:0 0 18px;font:700 22px/1.3 Georgia,'Times New Roman',serif;color:#141218;">${escapeHtml(titulo)}</h1>
            ${cuerpo}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 28px;border-top:1px solid #e4dfd7;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#6b655e;">
            ${pie ?? `${escapeHtml(barName)}`}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Boton de accion. En correo un boton es una tabla, no un `<a>` con padding. */
export function emailButton(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr><td align="center" bgcolor="#b4111b" style="border-radius:2px;">
    <a href="${href}" style="display:inline-block;padding:14px 28px;font:600 16px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
  </td></tr>
</table>`;
}

/** Parrafo con el estilo del cuerpo. */
export function emailP(texto: string) {
  return `<p style="margin:0 0 14px;">${texto}</p>`;
}

/**
 * Escapa lo que viene de afuera.
 *
 * El nombre y el mensaje de un formulario publico entran directo a un correo
 * que alguien del equipo va a abrir. Sin esto, cualquiera puede escribir
 * etiquetas en el campo "nombre" y decidir como se ve —o a donde apunta— el
 * correo que recibe el local.
 */
export function escapeHtml(valor: string) {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Texto libre a HTML, respetando los saltos de linea que escribio la persona. */
export function escapeMultiline(valor: string) {
  return escapeHtml(valor).replace(/\r?\n/g, "<br>");
}
