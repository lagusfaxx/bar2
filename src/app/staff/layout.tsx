import type { Metadata, Viewport } from "next";

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
};

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex min-h-[100svh] flex-col bg-ink">{children}</div>;
}
