import QRCode from "qrcode";

import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/utils";

/**
 * El QR de una tarjeta, como PNG servido por URL.
 *
 * Existe para el correo. Dentro de un mensaje, una imagen incrustada como
 * `data:` no se ve: Gmail y Outlook las descartan enteras, sin ofrecer siquiera
 * el boton de "mostrar imagenes". Las remotas si se muestran —Gmail las pasa
 * por su proxy y las cachea—, asi que el QR tiene que colgar de una direccion.
 *
 * No pide sesion, y no puede pedirla: quien abre el correo esta en su casilla,
 * no en el sitio, y la imagen la busca el proxy de Google y no su navegador.
 * Tampoco hace falta. El token que va en la ruta es exactamente el mismo que
 * viaja dentro del QR, asi que esta imagen no revela nada que el propio codigo
 * no revele al escanearlo: son la misma llave, dibujada de dos maneras. Y si
 * una tarjeta se pierde, rotar el token invalida las dos a la vez.
 */

/** Un token que no existe se responde igual que uno mal formado. */
function noEncontrado() {
  return new Response("No encontrado", { status: 404 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // El .png del final es cosmetico: hay clientes de correo que se niegan a
  // pedir una imagen cuya direccion no parece una imagen.
  const qrToken = token.replace(/\.png$/i, "");

  if (!qrToken || qrToken.length < 16) return noEncontrado();

  const card = await prisma.barzuCard.findUnique({
    where: { qrToken },
    select: { status: true },
  });

  if (!card) return noEncontrado();

  const png = await QRCode.toBuffer(
    absoluteUrl(`/staff/verificar/${qrToken}`),
    {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 512,
      color: { dark: "#08070aff", light: "#ffffffff" },
    },
  );

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      /*
       * Cache larga, pero solo en el navegador y en los proxies de correo.
       *
       * El contenido de un QR no cambia nunca: cambia el token, y con el la
       * direccion. Que Gmail lo guarde es justamente lo que hace que el correo
       * siga mostrando la tarjeta dentro de seis meses.
       */
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
