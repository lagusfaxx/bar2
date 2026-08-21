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

/**
 * El QR de la mesa: la carta y el numero, en un solo codigo.
 *
 * Antes eran dos pegatinas por mesa —una con la carta, otra con el karaoke— y
 * en una mesa de bar eso son dos cosas que se despegan, se manchan y se pegan
 * torcidas. Ademas obligaban al cliente a elegir cual escanear antes de saber
 * que hay detras de cada una.
 *
 * Ahora es uno solo y lleva el numero de mesa puesto (`?mesa=`), asi que abre
 * la carta con precios y de paso deja el karaoke a un toque, ya sabiendo desde
 * donde piden. El numero no autoriza nada —solo dice desde donde se escanea—
 * asi que no necesita ser un token secreto.
 *
 * La carta de la web no lleva precios —la puede abrir cualquiera, incluida la
 * competencia—, y por eso el precio vive solo en /carta/mesa: no es un secreto
 * criptografico, es la misma discrecion de una carta impresa que esta sobre la
 * mesa y no en la vitrina.
 *
 * Sin numero de mesa sigue sirviendo: abre la misma carta, sin el karaoke
 * prellenado. Es lo que se imprime cuando todavia no hay mesas cargadas en el
 * panel. Negro sobre blanco porque se imprime y se plastifica.
 */
export async function menuQrDataUrl(tableNumber?: number | null) {
  const destino =
    typeof tableNumber === "number" && Number.isFinite(tableNumber)
      ? `/carta/mesa?mesa=${tableNumber}`
      : "/carta/mesa";

  return QRCode.toDataURL(absoluteUrl(destino), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 480,
    color: {
      dark: "#000000ff",
      light: "#ffffffff",
    },
  });
}

/**
 * QR del karaoke, uno por mesa.
 *
 * Lleva a /karaoke con el numero de mesa puesto, para que quien lo escanea no
 * tenga que buscarse a si mismo en una lista. Ese numero no autoriza nada
 * —solo dice desde donde piden— asi que no necesita ser un token secreto: se
 * imprime una vez y vive pegado a la mesa. Va en blanco y negro puros porque
 * se imprime en papel comun.
 */
export async function karaokeQrDataUrl(tableNumber: number) {
  return QRCode.toDataURL(absoluteUrl(`/karaoke?mesa=${tableNumber}`), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 480,
    color: {
      dark: "#000000ff",
      light: "#ffffffff",
    },
  });
}
