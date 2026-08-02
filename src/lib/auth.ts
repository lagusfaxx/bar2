import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

import type { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const ADMIN_COOKIE = "barzuo_panel";
const MEMBER_COOKIE = "barzuo_card";
const SESSION_DAYS = 7;

export type PanelSession = {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
};

export type MemberSession = {
  memberId: string;
  email: string;
  fullName: string;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET debe estar definida y tener al menos 32 caracteres. Genera una con: openssl rand -base64 48",
    );
  }

  return new TextEncoder().encode(secret);
}

async function sign(payload: Record<string, unknown>, audience: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("barzuo")
    .setAudience(audience)
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

async function verify<T>(token: string, audience: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: "barzuo",
      audience,
    });
    return payload as T;
  } catch {
    return null;
  }
}

// --- Passwords ---------------------------------------------------------------

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// --- Sesion del panel (ADMIN / EDITOR / STAFF) --------------------------------

export async function createPanelSession(session: PanelSession) {
  const token = await sign({ ...session }, "panel");
  const store = await cookies();

  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroyPanelSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

export async function getPanelSession(): Promise<PanelSession | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const payload = await verify<PanelSession>(token, "panel");
  if (!payload?.userId) return null;

  // La cuenta puede haber sido desactivada o cambiada de rol despues de emitir
  // el token, asi que la fuente de verdad siempre es la base de datos.
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, role: true, active: true },
  });

  if (!user || !user.active) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

const CMS_ROLES: UserRole[] = ["ADMIN", "EDITOR"];

/** Exige una sesion valida con permiso sobre el CMS. Lanza si no la hay. */
export async function requireCmsUser(): Promise<PanelSession> {
  const session = await getPanelSession();

  if (!session || !CMS_ROLES.includes(session.role)) {
    throw new AuthError("No autorizado");
  }

  return session;
}

/** Exige rol ADMIN (gestion de usuarios y ajustes sensibles). */
export async function requireAdmin(): Promise<PanelSession> {
  const session = await getPanelSession();

  if (session?.role !== "ADMIN") {
    throw new AuthError("Se requiere rol de administrador");
  }

  return session;
}

/** Cualquier rol del panel puede usar la app de verificacion de BarzuCard. */
export async function requireStaff(): Promise<PanelSession> {
  const session = await getPanelSession();

  if (!session) {
    throw new AuthError("No autorizado");
  }

  return session;
}

// --- Sesion de socios BarzuCard ----------------------------------------------

export async function createMemberSession(session: MemberSession) {
  const token = await sign({ ...session }, "member");
  const store = await cookies();

  store.set(MEMBER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroyMemberSession() {
  const store = await cookies();
  store.delete(MEMBER_COOKIE);
}

export async function getMemberSession(): Promise<MemberSession | null> {
  const token = (await cookies()).get(MEMBER_COOKIE)?.value;
  if (!token) return null;

  const payload = await verify<MemberSession>(token, "member");
  if (!payload?.memberId) return null;

  const member = await prisma.member.findUnique({
    where: { id: payload.memberId },
    select: { id: true, email: true, fullName: true },
  });

  if (!member) return null;

  return {
    memberId: member.id,
    email: member.email,
    fullName: member.fullName,
  };
}

export async function requireMember(): Promise<MemberSession> {
  const session = await getMemberSession();

  if (!session) {
    throw new AuthError("Inicia sesion con tu BarzuCard");
  }

  return session;
}

export class AuthError extends Error {}

// --- Utilidades --------------------------------------------------------------

/**
 * Compara dos strings en tiempo constante. Se usa para tokens de QR, donde una
 * comparacion ingenua filtra informacion por timing.
 */
export function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Huella anonima de un visitante, para limitar una calificacion por persona y
 * evento sin almacenar la IP en claro.
 */
export function fingerprint(ip: string, userAgent: string) {
  return createHash("sha256")
    .update(`${ip}|${userAgent}|${process.env.AUTH_SECRET ?? ""}`)
    .digest("hex")
    .slice(0, 40);
}

export function randomToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}
