import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convierte texto libre en un slug apto para URL. */
export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Garantiza que el slug sea unico consultando la tabla correspondiente.
 * `exists` recibe un slug candidato y responde si ya esta tomado.
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
) {
  const root = slugify(base) || "item";
  let candidate = root;
  let suffix = 2;

  while (await exists(candidate)) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

/** Trunca respetando palabras, para excerpts y meta descriptions. */
export function truncate(text: string, max = 160) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

export function absoluteUrl(path = "/") {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
