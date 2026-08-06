import { ImageResponse } from "next/og";

import { getMemberSession } from "@/lib/auth";
import { getSettings } from "@/lib/content";
import { formatCardNumber, } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { cardQrDataUrl } from "@/lib/qr";

/**
 * La BarzuCard como imagen PNG, para guardarla en el telefono.
 *
 * Es la alternativa practica a un pase de Apple/Google Wallet, que exige
 * certificados de pago de cada plataforma: la imagen se guarda en la galeria,
 * se comparte y se muestra sin conexion, que es lo que hace falta en la barra.
 *
 * Se dibuja en el servidor con la API de imagenes de Next para que salga igual
 * en cualquier telefono, sin depender del navegador.
 */

const WIDTH = 1012;
const HEIGHT = 638; // proporcion de una tarjeta bancaria (85,6 × 54 mm)

/** Una sola tarjeta, un solo color: ya no hay niveles que distinguir. */
const COLORS = { accent: "#f2555f", glow: "rgba(225,29,42,0.35)" };

export async function GET() {
  const session = await getMemberSession();

  if (!session) {
    return new Response("Inicia sesión con tu BarzuCard", { status: 401 });
  }

  const [member, settings] = await Promise.all([
    prisma.member.findUnique({
      where: { id: session.memberId },
      select: {
        fullName: true,
        card: {
          select: {
            cardNumber: true,
            qrToken: true,
            issuedAt: true,
          },
        },
      },
    }),
    getSettings(),
  ]);

  if (!member?.card) {
    return new Response("No encontramos tu tarjeta", { status: 404 });
  }

  const card = member.card;
  const qr = await cardQrDataUrl(card.qrToken);
  const colors = COLORS;

  // El motor de imagenes exige que cada bloque tenga un unico hijo de texto,
  // asi que las lineas se arman antes de dibujar.
  const tierLine = settings.loyaltyTitle;
  const since = new Intl.DateTimeFormat("es-CL", {
    month: "2-digit",
    year: "numeric",
  }).format(card.issuedAt);
  const pointsLine = `Socio desde ${since}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 56,
          background: "#08070a",
          backgroundImage: `radial-gradient(120% 90% at 85% 0%, ${colors.glow}, transparent 60%), linear-gradient(135deg, #16131a 0%, #08070a 55%, #1a0d10 100%)`,
          border: `4px solid ${colors.accent}`,
          color: "#f4efe7",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 58, letterSpacing: 2, color: colors.accent }}>
              {settings.barName}
            </div>
            <div style={{ marginTop: 12, fontSize: 30, color: colors.accent }}>
              {tierLine}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 44 }}>{member.fullName}</div>
            <div style={{ marginTop: 14, fontSize: 36, color: "#c9c1b6" }}>
              {formatCardNumber(card.cardNumber)}
            </div>
            <div style={{ marginTop: 14, fontSize: 26, color: "#8d857c" }}>
              {pointsLine}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", background: "#ffffff", padding: 18, borderRadius: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="" width={330} height={330} />
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        // Es un archivo para guardar, no para cachear en intermediarios.
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="barzucard.png"',
      },
    },
  );
}
