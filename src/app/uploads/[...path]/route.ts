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
  // Video de fondo de la portada (ver saveVideoUpload en lib/uploads.ts).
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

/** "bytes=0-" o "bytes=1000-2000" → el tramo que pide el navegador. */
function parseRange(header: string | null, size: number) {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;

  // "bytes=-500" pide los ultimos 500 bytes.
  const start = rawStart ? Number(rawStart) : size - Number(rawEnd);
  const end = rawStart && rawEnd ? Number(rawEnd) : size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end >= size || start > end) return null;

  return { start, end };
}

export async function GET(
  request: Request,
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

    const common = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // Sin esto el navegador no puede pedir tramos y descarga el video
      // entero antes de mostrar nada.
      "Accept-Ranges": "bytes",
    };

    const range = parseRange(request.headers.get("range"), info.size);

    if (range) {
      const stream = Readable.toWeb(
        createReadStream(filePath, { start: range.start, end: range.end }),
      ) as ReadableStream<Uint8Array>;

      return new Response(stream, {
        status: 206,
        headers: {
          ...common,
          "Content-Length": String(range.end - range.start + 1),
          "Content-Range": `bytes ${range.start}-${range.end}/${info.size}`,
        },
      });
    }

    // Un rango mal formado o fuera de los limites merece un 416, no el
    // archivo entero: si no, el reproductor cree que el servidor lo ignora.
    if (request.headers.get("range")) {
      return new Response("Range Not Satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${info.size}` },
      });
    }

    const stream = Readable.toWeb(
      createReadStream(filePath),
    ) as ReadableStream<Uint8Array>;

    return new Response(stream, {
      headers: { ...common, "Content-Length": String(info.size) },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
