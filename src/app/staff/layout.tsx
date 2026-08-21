import type { Metadata, Viewport } from "next";

import { DeadZone } from "@/components/staff/dead-zone";
import { PreferenciaDeTeclado } from "@/components/staff/keyboard-preference";

export const metadata: Metadata = {
  title: { default: "BarzuCard · Verificación", template: "%s · BARZUO" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#08070a",
  width: "device-width",
  initialScale: 1,
  // La app se usa de pie, con una mano: conviene evitar el zoom accidental.
  maximumScale: 1,
  viewportFit: "cover",
  // Al abrir el teclado, la ventana se achica de verdad en vez de quedar el
  // teclado encima: asi las alturas en dvh y la barra inferior se reacomodan
  // solas y no queda nada tapado.
  interactiveWidget: "resizes-content",
};

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink">
      {/* Rarezas de este equipo: su franja ciega y si necesita que la app le
          ponga el teclado. Se configuran una vez y quedan guardadas ahi. */}
      <DeadZone />
      <PreferenciaDeTeclado />
      {children}
    </div>
  );
}
