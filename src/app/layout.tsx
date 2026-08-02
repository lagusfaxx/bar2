import type { Metadata, Viewport } from "next";
import Script from "next/script";

import { getSettings } from "@/lib/content";
import { fontVariables } from "@/lib/fonts";
import { absoluteUrl } from "@/lib/utils";

import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const ogImage = settings.seoImageUrl ?? "/demo/og-default.jpg";

  return {
    metadataBase: new URL(absoluteUrl("/")),
    title: {
      default: settings.seoTitle,
      // Cada pagina aporta su titulo y el sitio agrega la marca.
      template: `%s · ${settings.barName}`,
    },
    description: settings.seoDescription,
    keywords: settings.seoKeywords?.split(",").map((k) => k.trim()),
    applicationName: settings.barName,
    authors: [{ name: settings.barName }],
    creator: settings.barName,
    icons: settings.faviconUrl
      ? { icon: settings.faviconUrl, apple: settings.faviconUrl }
      : undefined,
    openGraph: {
      type: "website",
      locale: "es_UY",
      siteName: settings.barName,
      title: settings.seoTitle,
      description: settings.seoDescription,
      url: absoluteUrl("/"),
      images: [{ url: ogImage, width: 1200, height: 630, alt: settings.barName }],
    },
    twitter: {
      card: "summary_large_image",
      title: settings.seoTitle,
      description: settings.seoDescription,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    alternates: { canonical: absoluteUrl("/") },
  };
}

export const viewport: Viewport = {
  themeColor: "#08070a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSettings();

  return (
    <html
      lang="es"
      // Declara el scroll suave del CSS para que Next no lo aplique durante
      // las transiciones de ruta.
      data-scroll-behavior="smooth"
      className={`${fontVariables} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}

        {/* Analitica opcional: solo se carga si el administrador la configuro. */}
        {settings.googleAnalyticsId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${settings.googleAnalyticsId}`}
              strategy="afterInteractive"
            />
            <Script id="ga" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${settings.googleAnalyticsId}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
