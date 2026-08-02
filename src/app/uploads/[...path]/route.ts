import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { UPLOAD_DIR } from "@/lib/uploads";

/**
 * Sirve las imagenes cargadas desde el CMS.
 *
 * Viven fuera de public/ (en un volumen persistente), asi que necesitan su
 * propia ruta. El nombre de archivo lleva un hash, por lo que se pueden cachear
 * de forma indefinida.
 */

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  // Un segmento con ".." o separadores es siempre un intento de salir del
  // directorio: se rechaza antes de tocar el disco.
  if (segments.some((segment) => segment.includes("..") || segment.includes("/"))) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = path.join(UPLOAD_DIR, ...segments);

  if (!filePath.startsWith(UPLOAD_DIR + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[extension];

  if (!contentType) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const info = await stat(filePath);

    if (!info.isFile()) {
      return new Response("Not found", { status: 404 });
    }

    const stream = Readable.toWeb(
      createReadStream(filePath),
    ) as ReadableStream<Uint8Array>;

    return new Response(stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
