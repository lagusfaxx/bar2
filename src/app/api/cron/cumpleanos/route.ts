import { timingSafeEqual } from "node:crypto";

import { sendBirthdayGreetings } from "@/lib/birthdays";

/**
 * El disparador diario de los saludos de cumpleanos.
 *
 * La llama un temporizador externo —el cron de Coolify, el del servidor o un
 * servicio de fuera— una vez al dia. No se agenda dentro de la aplicacion a
 * proposito: un `setInterval` en el proceso de Next.js se duplica con cada
 * instancia y se pierde con cada despliegue, que son las dos formas de terminar
 * saludando dos veces o ninguna.
 *
 * Correr de mas es inofensivo: quien ya fue saludado este ano no vuelve a
 * entrar en la lista, asi que llamarla cinco veces el mismo dia manda los
 * mismos correos que llamarla una.
 */

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;

  // Sin secreto configurado la ruta queda cerrada. Es preferible no saludar a
  // dejar que cualquiera dispare correos a toda la base de socios.
  if (!expected || expected.length < 16) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const resumen = await sendBirthdayGreetings();

  return Response.json(resumen, { headers: { "Cache-Control": "no-store" } });
}
