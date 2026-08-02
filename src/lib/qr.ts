import "server-only";

import QRCode from "qrcode";

import { absoluteUrl } from "@/lib/utils";

/**
 * Genera el QR de una BarzuCard como data URL.
 *
 * El QR apunta a /staff/verificar/<token>: si el personal de sala ya tiene la app
 * abierta, escanear con la camara del telefono lo lleva directo a la ficha del
 * socio. El token es opaco y rotable, asi que una tarjeta perdida se invalida
 * sin cambiar el numero impreso.
 */
export async function cardQrDataUrl(qrToken: string) {
  return QRCode.toDataURL(absoluteUrl(`/staff/verificar/${qrToken}`), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
    color: {
      dark: "#08070aff",
      light: "#f4efe7ff",
    },
  });
}
