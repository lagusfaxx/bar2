import type { Metadata } from "next";

import { StaffScreen } from "@/components/staff/pos/screen";

/**
 * La sala es la unica pantalla instalable del sitio.
 *
 * El manifiesto se declara aca —en el layout de /staff/pos— y no en el layout
 * raiz a proposito: asi la ofrecen instalar los telefonos del equipo, que es
 * lo que se quiere, y no cada persona que entra a ver la carta o la cartelera.
 * Su alcance es /staff/pos, de modo que abrir una cuenta desde la app sigue
 * dentro de la app y cualquier otra direccion del sitio se abre en el
 * navegador.
 */
export const metadata: Metadata = {
  manifest: "/staff/pos/manifest.webmanifest",
  appleWebApp: {
    // Safari no lee el manifiesto para "Agregar a inicio": necesita esto.
    capable: true,
    title: "Sala",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/staff/pos/icono.png?size=180",
  },
};

export default function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StaffScreen>{children}</StaffScreen>;
}
