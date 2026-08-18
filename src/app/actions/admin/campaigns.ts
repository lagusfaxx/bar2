"use server";

import { revalidatePath } from "next/cache";

import { requireCmsUser } from "@/lib/auth";
import {
  campaignRecipients,
  renderCampaignBody,
  unsubscribeToken,
} from "@/lib/campaigns";
import { getSettings } from "@/lib/content";
import { destinatariosDeAviso, sendEmail } from "@/lib/email";
import { campaignEmail } from "@/lib/email-templates";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/utils";
import { campaignSchema, fieldErrors } from "@/lib/validation";

/**
 * Campanas de correo.
 *
 * Mandar a toda la base es la unica accion del panel que no se puede deshacer:
 * un evento mal publicado se despublica, un precio mal puesto se corrige, pero
 * un correo que salio ya esta en trescientas bandejas. Todo lo de aca esta
 * escrito alrededor de eso.
 */

export async function saveCampaign(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCmsUser();

  const rawId = formData.get("id");
  const campaignId = typeof rawId === "string" && rawId ? rawId : null;

  const parsed = campaignSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa los datos de la campaña.", fieldErrors(parsed.error));
  }

  const input = parsed.data;

  if (campaignId) {
    const actual = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });

    if (!actual) return formError("Esa campaña ya no existe.");

    /*
     * Una campana enviada no se edita.
     *
     * Editarla daria la impresion de haber cambiado lo que la gente recibio, y
     * lo que la gente recibio ya no se puede cambiar. Guardar el texto como
     * salio es tambien la unica forma de saber despues que se prometio.
     */
    if (actual.status !== "DRAFT") {
      return formError(
        "Esta campaña ya se envió y no se puede editar. Duplícala si quieres partir de ella.",
      );
    }

    await prisma.campaign.update({ where: { id: campaignId }, data: input });
  } else {
    await prisma.campaign.create({ data: input });
  }

  revalidatePath("/admin/campanas");

  return formSuccess("Campaña guardada.");
}

export async function deleteCampaign(id: string): Promise<void> {
  await requireCmsUser();

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { status: true },
  });

  // Ya no estaba: no hay nada que hacer y tampoco nada que reclamar.
  if (!campaign) return;

  // El registro de lo enviado se conserva aunque se borre la campana: los
  // correos que salieron pasaron y la lista de a quien le llego sigue
  // importando. Por eso el vinculo es SET NULL y no en cascada.
  await prisma.campaign.delete({ where: { id } });

  revalidatePath("/admin/campanas");
}

/**
 * Manda una prueba a las casillas del local.
 *
 * Es el paso que hay que dar antes del envio real y por eso esta puesto a la
 * misma altura del boton de enviar: un correo se ve distinto en la pantalla del
 * editor que en Gmail, y ese es el unico momento en que todavia se puede
 * arreglar.
 */
export async function sendCampaignTest(id: string): Promise<FormState> {
  await requireCmsUser();

  const campaign = await prisma.campaign.findUnique({ where: { id } });

  if (!campaign) return formError("Esa campaña ya no existe.");

  const settings = await getSettings();
  const destinos = destinatariosDeAviso(settings.notifyEmails);

  if (destinos.length === 0) {
    return formError(
      "No hay casillas de aviso configuradas. Agrégalas en Ajustes → Contacto.",
    );
  }

  const { subject, html } = campaignEmail({
    barName: settings.barName,
    logoUrl: settings.logoUrl,
    // El asunto se marca para que una prueba no se confunda con la campana real
    // en la bandeja de quien la revisa.
    subject: `[PRUEBA] ${campaign.subject}`,
    preheader: campaign.preheader,
    html: renderCampaignBody(campaign.html, "Nombre de prueba"),
    unsubscribeUrl: absoluteUrl("/barzucard/baja/prueba"),
  });

  const resultado = await sendEmail({
    to: destinos,
    subject,
    html,
    kind: "CAMPANA",
    campaignId: campaign.id,
  });

  return resultado.ok
    ? formSuccess(`Prueba enviada a ${destinos.join(", ")}.`)
    : formError(`No se pudo enviar: ${resultado.error}`);
}

/**
 * El envio real.
 *
 * Va uno por uno y no en un envio masivo: cada socio recibe su nombre y su
 * propio enlace de baja, y un fallo suelto no arrastra al resto. A cambio es
 * lento, asi que la campana queda en SENDING mientras corre y el panel muestra
 * el avance.
 */
export async function sendCampaign(id: string): Promise<FormState> {
  await requireCmsUser();

  const campaign = await prisma.campaign.findUnique({ where: { id } });

  if (!campaign) return formError("Esa campaña ya no existe.");

  /*
   * Una campana se manda una sola vez.
   *
   * La proteccion es la marca en la base y no un boton deshabilitado: dos
   * pestañas abiertas, o un doble clic, mandarian la campana dos veces a la
   * misma gente y no habria como recogerla.
   */
  if (campaign.status !== "DRAFT") {
    return formError(
      campaign.status === "SENDING"
        ? "Esta campaña se está enviando ahora mismo."
        : "Esta campaña ya se envió.",
    );
  }

  const destinatarios = await campaignRecipients(campaign.audience);

  if (destinatarios.length === 0) {
    return formError(
      "No hay socios en esa audiencia. Prueba con «Enviar prueba» para revisar el diseño.",
    );
  }

  const settings = await getSettings();

  await prisma.campaign.update({
    where: { id },
    data: {
      status: "SENDING",
      totalCount: destinatarios.length,
      sentCount: 0,
      failedCount: 0,
    },
  });

  let enviados = 0;
  let fallidos = 0;

  for (const member of destinatarios) {
    const { subject, html } = campaignEmail({
      barName: settings.barName,
      logoUrl: settings.logoUrl,
      subject: campaign.subject,
      preheader: campaign.preheader,
      html: renderCampaignBody(campaign.html, member.fullName),
      unsubscribeUrl: absoluteUrl(
        `/barzucard/baja/${unsubscribeToken(member.id)}`,
      ),
    });

    const resultado = await sendEmail({
      to: member.email,
      subject,
      html,
      kind: "CAMPANA",
      memberId: member.id,
      campaignId: campaign.id,
    });

    if (resultado.ok) enviados += 1;
    else fallidos += 1;
  }

  await prisma.campaign.update({
    where: { id },
    data: {
      status: enviados > 0 ? "SENT" : "FAILED",
      sentCount: enviados,
      failedCount: fallidos,
      sentAt: new Date(),
    },
  });

  revalidatePath("/admin/campanas");

  if (enviados === 0) {
    return formError(
      "No salió ningún correo. Revisa que RESEND_API_KEY y EMAIL_FROM estén configurados.",
    );
  }

  return formSuccess(
    fallidos > 0
      ? `Enviada a ${enviados} socios. ${fallidos} no salieron: revisa el detalle.`
      : `Enviada a ${enviados} socios.`,
  );
}

/** Cuantos recibirian la campana, para decirlo antes de mandarla. */
export async function countAudience(
  audience: "SUSCRITOS" | "TODOS" | "PRUEBA",
): Promise<number> {
  await requireCmsUser();
  return (await campaignRecipients(audience)).length;
}
