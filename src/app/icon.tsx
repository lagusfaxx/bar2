import { ImageResponse } from "next/og";

/**
 * Favicon generado: la "Z" del logotipo de BARZUO en blanco hueso sobre negro.
 * Se genera en el build, así que no depende de subir un archivo. El
 * administrador puede reemplazarlo cargando un favicon propio en Ajustes.
 */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
          color: "#f4efe7",
          fontSize: 46,
          fontWeight: 700,
          fontFamily: "Georgia, serif",
          borderBottom: "5px solid #b4111b",
        }}
      >
        Z
      </div>
    ),
    size,
  );
}
