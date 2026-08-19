import { ImageResponse } from "next/og";

/**
 * Icono de la app de sala instalada.
 *
 * Se dibuja aca en vez de guardar PNG en /public por lo mismo que el favicon
 * del sitio: es la marca del local sobre el fondo de la app, y si mañana
 * cambia el color no hay que reexportar archivos.
 *
 * `size` viene del manifiesto (192 y 512). `maskable` agrega el margen que
 * Android necesita para recortar el icono a la forma del sistema sin comerse
 * la letra: el area segura es el 80% central.
 */
export const dynamic = "force-dynamic";

const SIZES = new Set([180, 192, 512]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const pedido = Number(params.get("size"));
  const size = SIZES.has(pedido) ? pedido : 512;
  const maskable = params.get("maskable") === "1";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#08070a",
        }}
      >
        <div
          style={{
            width: maskable ? "80%" : "100%",
            height: maskable ? "80%" : "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#08070a",
            color: "#f4efe7",
            fontSize: size * (maskable ? 0.5 : 0.62),
            fontWeight: 700,
            fontFamily: "Georgia, serif",
            borderBottom: `${Math.max(3, Math.round(size * 0.06))}px solid #b4111b`,
          }}
        >
          Z
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
