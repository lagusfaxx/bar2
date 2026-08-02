import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp, { type Metadata, type Sharp } from "sharp";

import { prisma } from "@/lib/prisma";

/**
 * Almacenamiento de imagenes del CMS.
 *
 * Los archivos NO van a public/: en produccion la app corre desde la salida
 * `standalone` y public/ es de solo lectura y se sirve segun un listado hecho
 * en el build. Van a un directorio propio (UPLOAD_DIR), que en Docker es un
 * volumen persistente, y se sirven por la ruta /uploads/* (ver
 * app/uploads/[...path]/route.ts).
 */

/**
 * Directorio de las subidas.
 *
 * Se admite una ruta absoluta (lo habitual en Docker: /app/storage/uploads) o
 * una relativa, que se ancla al directorio de trabajo.
 *
 * Nota: al ser una ruta configurable en tiempo de ejecucion, el build emite un
 * aviso de rastreo ("unexpected file in NFT list") y copia el codigo fuente
 * dentro de la salida standalone. Es inocuo —solo agrega unos MB a la imagen—
 * y es el precio de que el volumen de subidas sea configurable.
 */
const CONFIGURED_UPLOAD_DIR = process.env.UPLOAD_DIR ?? "storage/uploads";

export const UPLOAD_DIR = CONFIGURED_UPLOAD_DIR.startsWith("/")
  ? CONFIGURED_UPLOAD_DIR
  : path.join(process.cwd(), CONFIGURED_UPLOAD_DIR);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

/** Ancho maximo por destino: no tiene sentido guardar un afiche de 6000px. */
const PRESETS = {
  poster: 1400,
  cover: 2400,
  gallery: 2000,
  product: 1200,
  logo: 800,
} as const;

export type UploadPreset = keyof typeof PRESETS;

export type UploadResult = {
  url: string;
  width: number;
  height: number;
  size: number;
};

export class UploadError extends Error {}

/**
 * Procesa y guarda una imagen subida desde el panel.
 *
 * Todo se normaliza a WebP: recorta el peso a la mitad frente al JPEG original
 * y unifica el formato, de modo que la web publica no depende de lo que suba
 * cada persona.
 */
export async function saveUpload(
  file: File,
  preset: UploadPreset = "gallery",
): Promise<UploadResult> {
  if (!file || file.size === 0) {
    throw new UploadError("No se recibió ningún archivo.");
  }

  if (file.size > MAX_BYTES) {
    throw new UploadError("La imagen supera los 10 MB.");
  }

  if (!ALLOWED_MIME.has(file.type)) {
    throw new UploadError(
      "Formato no admitido. Subí una imagen JPG, PNG, WebP, AVIF o GIF.",
    );
  }

  const input = Buffer.from(await file.arrayBuffer());

  let pipeline: Sharp;
  let metadata: Metadata;

  try {
    pipeline = sharp(input, { animated: file.type === "image/gif" });
    metadata = await pipeline.metadata();
  } catch {
    // El archivo dice ser una imagen pero sharp no puede leerlo.
    throw new UploadError("No pudimos procesar la imagen. Probá con otro archivo.");
  }

  if (!metadata.width || !metadata.height) {
    throw new UploadError("El archivo no parece ser una imagen válida.");
  }

  const maxWidth = PRESETS[preset];

  const output = await pipeline
    .rotate() // respeta la orientación EXIF de las fotos de celular
    .resize({
      width: Math.min(metadata.width, maxWidth),
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  // Nombre con hash: permite cachear de forma agresiva y evita colisiones.
  const stamp = new Date();
  const folder = `${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, "0")}`;
  const filename = `${randomBytes(12).toString("hex")}.webp`;

  const targetDir = path.join(UPLOAD_DIR, folder);
  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, filename), output.data);

  const url = `/uploads/${folder}/${filename}`;

  await prisma.media.create({
    data: {
      url,
      filename,
      originalName: file.name.slice(0, 200),
      mimeType: "image/webp",
      size: output.info.size,
      width: output.info.width,
      height: output.info.height,
    },
  });

  return {
    url,
    width: output.info.width,
    height: output.info.height,
    size: output.info.size,
  };
}

/** Borra un archivo subido y su registro. Las rutas ajenas se ignoran. */
export async function deleteUpload(url: string) {
  if (!url.startsWith("/uploads/")) return;

  const relative = url.replace(/^\/uploads\//, "");
  const target = path.join(UPLOAD_DIR, relative);

  // Defensa ante rutas con "..": nunca salimos del directorio de subidas.
  if (!target.startsWith(UPLOAD_DIR + path.sep)) return;

  try {
    await unlink(target);
  } catch {
    // El archivo ya no está: seguimos para limpiar el registro igualmente.
  }

  await prisma.media.deleteMany({ where: { url } });
}

export function listMedia(take = 60, skip = 0) {
  return prisma.media.findMany({
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });
}
