import "server-only";

import {
  emailButton,
  emailLayout,
  emailP,
  escapeHtml,
  escapeMultiline,
} from "@/lib/email";
import { absoluteUrl } from "@/lib/utils";

/**
 * Los correos que manda el local, uno por archivo de plantilla.
 *
 * Cada funcion devuelve asunto y HTML listos para `sendEmail`. Viven juntas y
 * aparte del envio para que se puedan leer todas de corrido: es la voz del
 * local escrita en un solo lugar, y asi no termina un correo tuteando y otro
 * hablando de usted.
 */

type Marca = { barName: string; logoUrl?: string | null };

/**
 * Aviso interno: alguien escribio por la web.
 *
 * Va con `replyTo` puesto en el correo de quien escribio, que es el detalle que
 * lo hace util: se responde con el boton de responder del cliente de correo,
 * sin copiar direcciones a mano ni entrar al panel.
 */
export function contactNotification({
  barName,
  logoUrl,
  nombre,
  email,
  telefono,
  asunto,
  mensaje,
}: Marca & {
  nombre: string;
  email: string;
  telefono: string | null;
  asunto: string | null;
  mensaje: string;
}) {
  const filas = [
    ["Nombre", escapeHtml(nombre)],
    ["Email", `<a href="mailto:${escapeHtml(email)}" style="color:#b4111b;">${escapeHtml(email)}</a>`],
    telefono
      ? [
          "Teléfono",
          `<a href="https://wa.me/${telefono.replace(/\D/g, "")}" style="color:#b4111b;">${escapeHtml(telefono)}</a>`,
        ]
      : null,
    asunto ? ["Asunto", escapeHtml(asunto)] : null,
  ].filter(Boolean) as Array<[string, string]>;

  const tabla = filas
    .map(
      ([etiqueta, valor]) =>
        `<tr>
          <td style="padding:6px 12px 6px 0;color:#6b655e;white-space:nowrap;vertical-align:top;">${etiqueta}</td>
          <td style="padding:6px 0;color:#232025;">${valor}</td>
        </tr>`,
    )
    .join("");

  const cuerpo = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      ${tabla}
    </table>

    <div style="margin:22px 0 0;padding:18px;background:#f6f3ee;border-left:3px solid #b4111b;">
      <div style="margin:0 0 8px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#6b655e;">El mensaje</div>
      <div style="color:#232025;">${escapeMultiline(mensaje)}</div>
    </div>

    ${emailP('<span style="color:#6b655e;font-size:14px;">Responde este correo y le llega directo a quien escribió. O contéstale desde el panel, que además deja la respuesta guardada para el resto del equipo.</span>')}

    ${emailButton(absoluteUrl("/admin/mensajes"), "Responder desde el panel")}
  `;

  return {
    // El asunto lleva el nombre para poder distinguir dos avisos en la bandeja
    // sin abrirlos, que es como se leen los avisos.
    subject: `Nuevo mensaje de ${nombre}${asunto ? ` · ${asunto}` : ""}`,
    html: emailLayout({
      barName,
      logoUrl,
      titulo: "Escribieron por la web",
      cuerpo,
      pie: `Aviso automático de ${escapeHtml(barName)}. Llega a las casillas configuradas en Ajustes.`,
    }),
  };
}

/**
 * La tarjeta del socio, por correo.
 *
 * Sirve para el alta y para el reenvio a pedido, con el mismo cuerpo y distinto
 * encabezado: es la misma tarjeta y no hay razon para que se vean distinto.
 *
 * El QR va como imagen remota y no incrustada. Es al reves de lo que uno
 * supone: una imagen `data:` dentro de un correo la descartan Gmail y Outlook
 * enteras, sin ofrecer siquiera el boton de "mostrar imagenes", mientras que
 * una remota si se muestra —Gmail la pasa por su proxy y la cachea—. Un QR
 * que no se ve es una tarjeta que no sirve, asi que cuelga de una direccion:
 * `/barzucard/qr/<token>.png`.
 *
 * El numero va ademas en texto, que es el respaldo para el cliente de correo
 * que igual bloquee las imagenes.
 */
export function cardEmail({
  barName,
  logoUrl,
  loyaltyTitle,
  fullName,
  cardNumber,
  qrUrl,
  bienvenida,
}: Marca & {
  loyaltyTitle: string;
  fullName: string;
  cardNumber: string;
  /** Direccion publica del PNG. Incrustarlo como `data:` no se ve en Gmail. */
  qrUrl: string;
  /** Alta reciente, en vez de reenvio a pedido. */
  bienvenida: boolean;
}) {
  const nombre = escapeHtml(fullName.split(" ")[0] ?? fullName);
  const formateado = cardNumber.replace(/(\d{4})(?=\d)/g, "$1 ");

  const cuerpo = `
    ${emailP(
      bienvenida
        ? `Hola ${nombre}, ya eres parte de ${escapeHtml(loyaltyTitle)}. Esta es tu tarjeta: muéstrala en el local y te aplicamos los beneficios que tengas disponibles.`
        : `Hola ${nombre}, acá va tu tarjeta ${escapeHtml(loyaltyTitle)} de nuevo, como pediste.`,
    )}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:26px 0;">
      <tr>
        <td align="center" style="padding:26px;background:#08070a;border-radius:6px;">
          <div style="margin:0 0 4px;font:400 11px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#c9a227;">${escapeHtml(loyaltyTitle)}</div>
          <div style="margin:0 0 18px;font:700 19px/1.3 Georgia,'Times New Roman',serif;color:#f4efe7;">${escapeHtml(fullName)}</div>

          <img src="${qrUrl}" alt="Código QR de tu tarjeta" width="200" height="200" style="display:block;margin:0 auto;width:200px;height:200px;background:#ffffff;padding:10px;border-radius:4px;">

          <div style="margin:18px 0 0;font:400 15px/1 'Courier New',Courier,monospace;letter-spacing:.18em;color:#cdc5bb;">${escapeHtml(formateado)}</div>
        </td>
      </tr>
    </table>

    ${emailP('<span style="color:#6b655e;font-size:14px;">Si el código no se ve, toca «Mostrar imágenes» arriba. También sirve dictar el número de la tarjeta en el local.</span>')}

    ${emailButton(absoluteUrl("/barzucard/tarjeta"), "Ver mi tarjeta y beneficios")}
  `;

  return {
    subject: bienvenida
      ? `Tu ${loyaltyTitle} ya está lista`
      : `Tu ${loyaltyTitle}`,
    html: emailLayout({
      barName,
      logoUrl,
      titulo: bienvenida ? `¡Bienvenido, ${fullName.split(" ")[0] ?? fullName}!` : "Tu tarjeta",
      cuerpo,
      pie: `${escapeHtml(barName)} · Guarda este correo para tener tu tarjeta siempre a mano.`,
    }),
  };
}

/**
 * La respuesta del local a quien escribio por la web.
 *
 * Lleva citado abajo el mensaje original. Puede pasar una semana entre la
 * consulta y la respuesta, y para entonces quien pregunto ya no se acuerda de
 * como lo pregunto: sin la cita, la respuesta llega sin contexto y obliga a ir
 * a buscar el correo propio.
 *
 * El `replyTo` apunta a la casilla de contacto del local, no al remitente
 * tecnico: si el cliente contesta —y contesta seguido, porque una respuesta
 * abre conversacion— tiene que caer en una casilla que alguien lee.
 */
export function contactReplyEmail({
  barName,
  logoUrl,
  nombre,
  respuesta,
  mensajeOriginal,
  fechaOriginal,
  firma,
}: Marca & {
  nombre: string;
  respuesta: string;
  mensajeOriginal: string;
  fechaOriginal: string;
  /** Quien contesta, para que la respuesta la firme una persona y no un sistema. */
  firma: string | null;
}) {
  const cuerpo = `
    ${emailP(`Hola ${escapeHtml(nombre.split(" ")[0] ?? nombre)},`)}

    <div style="color:#232025;">${escapeMultiline(respuesta)}</div>

    ${
      firma
        ? emailP(
            `<span style="color:#6b655e;">${escapeHtml(firma)}<br>${escapeHtml(barName)}</span>`,
          )
        : ""
    }

    <div style="margin:32px 0 0;padding:16px 18px;background:#f6f3ee;border-left:3px solid #d8d2c9;">
      <div style="margin:0 0 8px;font-size:12px;color:#6b655e;">
        Tu mensaje del ${escapeHtml(fechaOriginal)}
      </div>
      <div style="color:#6b655e;font-size:14px;">${escapeMultiline(mensajeOriginal)}</div>
    </div>
  `;

  return {
    // "Re:" delante: es la convencion que hace que el cliente de correo lo
    // agrupe con lo que el mismo escribio, y que se lea como una respuesta y no
    // como un correo suelto del local.
    subject: `Re: tu mensaje a ${barName}`,
    html: emailLayout({
      barName,
      logoUrl,
      titulo: `Te respondemos`,
      cuerpo,
      pie: `${escapeHtml(barName)} · Puedes responder este correo si necesitas algo más.`,
    }),
  };
}

/**
 * Enlace para volver a entrar.
 *
 * No dice "olvidaste tu contrasena" sino lo que hay que hacer. Y lleva el plazo
 * escrito: un enlace que caduca sin avisar manda a la gente de vuelta al
 * formulario sin entender por que no funciono.
 */
export function passwordResetEmail({
  barName,
  logoUrl,
  fullName,
  url,
  horas,
}: Marca & { fullName: string; url: string; horas: number }) {
  const cuerpo = `
    ${emailP(`Hola ${escapeHtml(fullName.split(" ")[0] ?? fullName)}, pediste volver a entrar a tu cuenta. Este enlace te deja elegir una contraseña nueva:`)}

    ${emailButton(url, "Elegir contraseña nueva")}

    ${emailP(`<span style="color:#6b655e;font-size:14px;">El enlace sirve una sola vez y vence en ${horas} ${horas === 1 ? "hora" : "horas"}.</span>`)}

    ${emailP('<span style="color:#6b655e;font-size:14px;">Si no fuiste tú, no tienes que hacer nada: tu contraseña actual sigue funcionando y nadie puede entrar con este correo solo.</span>')}
  `;

  return {
    subject: "Volver a entrar a tu cuenta",
    html: emailLayout({
      barName,
      logoUrl,
      titulo: "Elige una contraseña nueva",
      cuerpo,
      pie: escapeHtml(barName),
    }),
  };
}

/**
 * El saludo de cumpleanos.
 *
 * Con beneficio o sin el. Sin beneficio configurado igual se manda el saludo:
 * un local que se acuerda del cumpleanos de un cliente ya gano algo, y mandar
 * nada es peor que mandar solo el saludo.
 */
export function birthdayEmail({
  barName,
  logoUrl,
  fullName,
  promocion,
}: Marca & {
  fullName: string;
  promocion: { title: string; description: string; terms: string | null } | null;
}) {
  // Sin escapar: va al asunto, que es texto plano, y al titulo, que lo escapa
  // `emailLayout`. Escaparlo aca lo dejaria con "&amp;" a la vista en la bandeja.
  const primerNombre = fullName.split(" ")[0] ?? fullName;

  const beneficio = promocion
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;">
      <tr>
        <td style="padding:22px;background:#fdf6e0;border-left:3px solid #c9a227;">
          <div style="margin:0 0 6px;font:400 11px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#a8871c;">Tu regalo</div>
          <div style="margin:0 0 8px;font:700 19px/1.3 Georgia,'Times New Roman',serif;color:#141218;">${escapeHtml(promocion.title)}</div>
          <div style="color:#232025;font-size:15px;">${escapeMultiline(promocion.description)}</div>
          ${promocion.terms ? `<div style="margin:10px 0 0;color:#6b655e;font-size:13px;">${escapeMultiline(promocion.terms)}</div>` : ""}
        </td>
      </tr>
    </table>
    ${emailP('Muestra tu tarjeta en el local y te lo aplicamos.')}
    ${emailButton(absoluteUrl("/barzucard/tarjeta"), "Ver mi tarjeta")}`
    : `${emailP("Te esperamos para celebrarlo.")}${emailButton(absoluteUrl("/eventos"), "Ver qué hay esta semana")}`;

  return {
    subject: `¡Feliz cumpleaños, ${primerNombre}!`,
    html: emailLayout({
      barName,
      logoUrl,
      titulo: `¡Feliz cumpleaños, ${primerNombre}!`,
      cuerpo: `${emailP(`De parte de todo el equipo de ${escapeHtml(barName)}, que lo pases increíble.`)}${beneficio}`,
      pie: escapeHtml(barName),
    }),
  };
}

/**
 * El envoltorio de una campana.
 *
 * El cuerpo lo escribe el administrador y entra tal cual; lo que agrega esto es
 * el encabezado con el logo, el preencabezado y —lo que no es opcional— el pie
 * con la baja. Un correo comercial sin forma de darse de baja es lo que hace
 * que el dominio entero termine marcado como no deseado.
 */
export function campaignEmail({
  barName,
  logoUrl,
  subject,
  preheader,
  html,
  unsubscribeUrl,
}: Marca & {
  subject: string;
  preheader: string | null;
  html: string;
  unsubscribeUrl: string;
}) {
  // Texto de vista previa: se ve en la bandeja, junto al asunto, y no en el
  // correo abierto. Por eso va oculto.
  const vistaPrevia = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>`
    : "";

  const pie = `${escapeHtml(barName)} · Recibes este correo porque te suscribiste a las novedades.
    <br><a href="${unsubscribeUrl}" style="color:#6b655e;">Darme de baja</a>`;

  return {
    subject,
    html: vistaPrevia + emailLayout({ barName, logoUrl, titulo: subject, cuerpo: html, pie }),
  };
}
