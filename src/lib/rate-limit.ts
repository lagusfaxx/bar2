import "server-only";

import { headers } from "next/headers";

/**
 * Limitador de peticiones en memoria, pensado para una sola instancia (el
 * despliegue tipico en Coolify). Protege login, registro, formulario de
 * contacto y canjes de la BarzuCard frente a fuerza bruta y spam.
 *
 * Si algun dia la app escala a varias replicas, este modulo es el unico punto
 * a cambiar por Redis.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  if (buckets.size > MAX_BUCKETS) sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return {
    ok: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/** IP del visitante, contemplando el proxy inverso de Coolify/Traefik. */
export async function clientIp() {
  const store = await headers();

  const forwarded = store.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();

  return store.get("x-real-ip") ?? "0.0.0.0";
}

export async function clientUserAgent() {
  return (await headers()).get("user-agent") ?? "unknown";
}
