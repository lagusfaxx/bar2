"use server";

import { randomBytes } from "node:crypto";

import { hashPassword } from "@/lib/auth";
import { getMemberSession } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { sendEmail } from "@/lib/email";
import { cardEmail, passwordResetEmail } from "@/lib/email-templates";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import {
  RESET_TTL_HORAS,
  findValidReset,
  hashToken,
} from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { absoluteUrl } from "@/lib/utils";
import { fieldErrors, passwordResetSchema, requestResetSchema } from "@/lib/validation";

/**
 * La cuenta del socio: recuperar el acceso y recibir la tarjeta.
 *
 * Son las dos cosas que un socio necesita hacer solo, sin escribirle a nadie.
 * Hasta ahora ninguna de las dos existia: quien olvidaba la contrasena perdia
 * la cuenta —y con ella su historial de canjes— sin forma de recuperarla.
 */

/**
 * Pide el enlace para volver a entrar.
 *
 * Responde siempre lo mismo, exista o no la cuenta. Es deliberado: si dijera
 * "no hay ninguna cuenta con ese email", el formulario se convierte en una
 * forma de averiguar quien es socio del local probando direcciones. Quien
 * escribio bien su correo lo recibe; quien se equivoco no recibe nada, que es
 * exactamente lo que le pasaria si le dijeramos que no existe.
 */
export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await clientIp();
  const limit = rateLimit(`reset:${ip}`, 5, 60 * 30);

  if (!limit.ok) {
    return formError("Ya pediste el enlace varias veces. Espera unos minutos.");
  }

  const parsed = requestResetSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa el correo que escribiste.", fieldErrors(parsed.error));
  }

  const respuesta = formSuccess(
    "Si hay una cuenta con ese correo, te llega el enlace en un momento. Revisa también el correo no deseado.",
  );

  const member = await prisma.member.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, fullName: true },
  });

  if (!member) return respuesta;

  /*
   * Los enlaces anteriores dejan de servir.
   *
   * Alguien que pide el enlace tres veces porque no le llegaba termina con tres
   * correos en la bandeja y abre cualquiera. Que valga solo el ultimo evita que
   * uno viejo, reenviado o guardado, siga abriendo la cuenta.
   */
  await prisma.passwordReset.updateMany({
    where: { memberId: member.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomBytes(32).toString("hex");

  await prisma.passwordReset.create({
    data: {
      memberId: member.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_HORAS * 60 * 60 * 1000),
    },
  });

  const settings = await getSettings();
  const { subject, html } = passwordResetEmail({
    barName: settings.barName,
    logoUrl: settings.logoUrl,
    fullName: member.fullName,
    url: absoluteUrl(`/barzucard/recuperar/${token}`),
    horas: RESET_TTL_HORAS,
  });

  await sendEmail({
    to: member.email,
    subject,
    html,
    kind: "RECUPERAR",
    memberId: member.id,
  });

  return respuesta;
}

/**
 * Elige la contrasena nueva.
 *
 * Al terminar NO se inicia sesion sola. Es a proposito: quien acaba de cambiar
 * la clave tiene que probarla una vez, y si el enlace lo abrio otra persona en
 * otro aparato, entrar sola le regalaria la cuenta.
 */
export async function resetPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await clientIp();
  const limit = rateLimit(`reset-set:${ip}`, 10, 60 * 30);

  if (!limit.ok) return formError("Demasiados intentos. Espera unos minutos.");

  const parsed = passwordResetSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa la contraseña.", fieldErrors(parsed.error));
  }

  const reset = await findValidReset(parsed.data.token);

  if (!reset) {
    return formError(
      "Este enlace ya no sirve: se usó o venció. Pide uno nuevo desde «Olvidé mi contraseña».",
    );
  }

  await prisma.$transaction([
    prisma.member.update({
      where: { id: reset.member.id },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    }),
    prisma.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return formSuccess("Listo, tu contraseña quedó cambiada. Ya puedes entrar.");
}

/**
 * Manda la tarjeta al correo del socio.
 *
 * Sirve para el que cambio de telefono, borro el correo de bienvenida o
 * simplemente no la encuentra. Va a la direccion registrada y no a una que se
 * escriba en el momento: si no, cualquiera con la sesion abierta un minuto
 * podria mandarse la tarjeta de otro a su propia casilla.
 */
export async function sendMyCard(): Promise<FormState> {
  const session = await getMemberSession();

  if (!session) return formError("Inicia sesión para recibir tu tarjeta.");

  const limit = rateLimit(`card-mail:${session.memberId}`, 3, 60 * 60);

  if (!limit.ok) {
    return formError("Ya te la enviamos hace poco. Revisa tu correo, incluido el no deseado.");
  }

  const member = await prisma.member.findUnique({
    where: { id: session.memberId },
    select: {
      id: true,
      email: true,
      fullName: true,
      card: { select: { cardNumber: true, qrToken: true, status: true } },
    },
  });

  if (!member?.card) return formError("No encontramos tu tarjeta.");

  if (member.card.status !== "ACTIVE") {
    return formError(
      "Tu tarjeta no está activa. Escríbenos y la revisamos.",
    );
  }

  const settings = await getSettings();
  const { subject, html } = cardEmail({
    barName: settings.barName,
    logoUrl: settings.logoUrl,
    loyaltyTitle: settings.loyaltyTitle,
    fullName: member.fullName,
    cardNumber: member.card.cardNumber,
    qrUrl: absoluteUrl(`/barzucard/qr/${member.card.qrToken}.png`),
    bienvenida: false,
  });

  const resultado = await sendEmail({
    to: member.email,
    subject,
    html,
    kind: "TARJETA",
    memberId: member.id,
  });

  if (!resultado.ok) {
    return formError(
      "No pudimos enviar el correo en este momento. Tu tarjeta sigue disponible en esta página.",
    );
  }

  return formSuccess(`Te la enviamos a ${member.email}.`);
}
