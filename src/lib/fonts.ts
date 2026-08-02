import { Inter, Playfair_Display, Rye } from "next/font/google";

/** Serif de alto contraste para titulos: elegante y nocturna. */
export const displayFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

/** Sans neutra para textos e interfaz. */
export const sansFont = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

/**
 * Display "western" que hace eco del logotipo de BARZUO.
 * Se usa con moderacion: acentos, etiquetas y el "EST. 2024".
 */
export const westernFont = Rye({
  subsets: ["latin"],
  variable: "--font-western",
  display: "swap",
  weight: "400",
});

export const fontVariables = `${displayFont.variable} ${sansFont.variable} ${westernFont.variable}`;
