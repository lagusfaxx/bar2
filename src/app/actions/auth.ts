"use server";

import { redirect } from "next/navigation";

import {
  createMemberSession,
  createPanelSession,
  destroyMemberSession,
  destroyPanelSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { generateCardNumber, generateQrToken } from "@/lib/barzucard";
import { formError, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  fieldErrors,
  loginSchema,
  memberRegisterSchema,
} from "@/lib/validation";

/**
 * Mensaje unico para credenciales incorrectas: no revela si el email existe.
 */
const BAD_CREDENTIALS = "Email o contraseña incorrectos.";

/** Evita que un `volver` manipulado redirija fuera del sitio. */
function safeRedirect(target: string | null, fallback: string) {
  if (!target) return fallback;
  if (!target.startsWith("/") || target.startsWith("//")) return fallback;
  return target;
}

// --- Panel (administradores y personal de sala) --------------------------------------

export async function loginPanel(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await clientIp();
  const limit = rateLimit(`login-panel:${ip}`, 8, 60 * 10);

  if (!limit.ok) {
    return formError(
      `Demasiados intentos. Prueba de nuevo en ${Math.ceil(limit.retryAfterSeconds / 60)} minutos.`,
    );
  }

  const parsed = loginSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa los datos.", fieldErrors(parsed.error));
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (!user || !user.active) {
    // Igualamos el costo con el de una verificación real para no filtrar por
    // tiempo si el email existe.
    await verifyPassword(parsed.data.password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    return formError(BAD_CREDENTIALS);
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!valid) {
    return formError(BAD_CREDENTIALS);
  }

  await createPanelSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "login",
      entity: "User",
      entityId: user.id,
      summary: `Ingreso al panel (${user.role})`,
    },
  });

  const requested = formData.get("volver");
  const fallback = user.role === "STAFF" ? "/staff" : "/admin";

  redirect(
    safeRedirect(typeof requested === "string" ? requested : null, fallback),
  );
}

export async function logoutPanel() {
  await destroyPanelSession();
  redirect("/admin/login");
}

// --- Socios BarzuCard --------------------------------------------------------

export async function registerMember(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await clientIp();
  const limit = rateLimit(`register:${ip}`, 5, 60 * 60);

  if (!limit.ok) {
    return formError("Demasiados registros desde esta conexión. Prueba más tarde.");
  }

  const parsed = memberRegisterSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa los datos del formulario.", fieldErrors(parsed.error));
  }

  const { email, password, fullName, phone, birthDate, acceptsNews } = parsed.data;

  const existing = await prisma.member.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    return formError(
      "Ya existe una cuenta con ese email. Inicia sesión para ver tu tarjeta.",
      { email: "Este email ya está registrado" },
    );
  }

  // La tarjeta se emite en la misma transacción que el alta: un socio nunca
  // queda registrado sin BarzuCard.
  const member = await prisma.member.create({
    data: {
      email,
      fullName,
      passwordHash: await hashPassword(password),
      phone: phone || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      acceptsNews,
      card: {
        create: {
          cardNumber: await generateCardNumber(),
          qrToken: generateQrToken(),
        },
      },
    },
    select: { id: true, email: true, fullName: true },
  });

  await createMemberSession({
    memberId: member.id,
    email: member.email,
    fullName: member.fullName,
  });

  redirect("/barzucard/tarjeta?bienvenida=1");
}

export async function loginMember(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await clientIp();
  const limit = rateLimit(`login-member:${ip}`, 10, 60 * 10);

  if (!limit.ok) {
    return formError("Demasiados intentos. Prueba de nuevo en unos minutos.");
  }

  const parsed = loginSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa los datos.", fieldErrors(parsed.error));
  }

  const member = await prisma.member.findUnique({
    where: { email: parsed.data.email },
  });

  if (!member) {
    await verifyPassword(parsed.data.password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    return formError(BAD_CREDENTIALS);
  }

  const valid = await verifyPassword(parsed.data.password, member.passwordHash);

  if (!valid) {
    return formError(BAD_CREDENTIALS);
  }

  // Un socio antiguo sin tarjeta (por una importación, por ejemplo) la recibe
  // al primer ingreso.
  const card = await prisma.barzuCard.findUnique({
    where: { memberId: member.id },
    select: { id: true },
  });

  if (!card) {
    await prisma.barzuCard.create({
      data: {
        memberId: member.id,
        cardNumber: await generateCardNumber(),
        qrToken: generateQrToken(),
      },
    });
  }

  await createMemberSession({
    memberId: member.id,
    email: member.email,
    fullName: member.fullName,
  });

  await prisma.member.update({
    where: { id: member.id },
    data: { lastLoginAt: new Date() },
  });

  const requested = formData.get("volver");
  redirect(
    safeRedirect(
      typeof requested === "string" ? requested : null,
      "/barzucard/tarjeta",
    ),
  );
}

export async function logoutMember() {
  await destroyMemberSession();
  redirect("/barzucard");
}
