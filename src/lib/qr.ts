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
      light: "#ffffffff",
    },
  });
}

/**
 * QR de un cupon de descuento, distinto del de la tarjeta.
 *
 * El de la tarjeta dice quien es el socio; este dice ademas que eligio canjear.
 * Al escanearlo, el equipo de sala cae en la pantalla de ese descuento y solo
 * tiene que confirmar: no tiene que adivinar la promocion ni buscarla en una
 * lista. Se genera mas grande porque se escanea desde la pantalla del cliente,
 * a veces con brillo bajo.
 */
export async function voucherQrDataUrl(token: string) {
  return QRCode.toDataURL(absoluteUrl(`/staff/canjear/${token}`), {
    errorCorrectionLevel: "Q",
    margin: 1,
    width: 640,
    color: {
      dark: "#08070aff",
      light: "#f4efe7ff",
    },
  });
}
