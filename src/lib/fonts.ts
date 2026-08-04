import { Inter, Playfair_Display, Rye } from "next/font/google";

/**
 * Serif de alto contraste para titulos: elegante y nocturna.
 *
 * Sin la cursiva. Es un archivo propio de 37,9 KB —casi un tercio de toda la
 * tipografia que se precarga en cada visita— y en todo el sitio se usa en dos
 * lugares: el marquee de la portada y un subtitulo en la ficha de evento. En
 * esos dos el navegador la inclina por su cuenta, que a ese tamaño no se
 * distingue, y el telefono deja de bajar 37,9 KB antes de ver nada.
 *
 * Los pesos si se declaran todos: Playfair es una fuente variable, o sea que
 * viaja en un solo archivo cubra los que cubra. Recortarlos no ahorraria nada
 * —lo comprobe midiendo el build— y limitaria el diseño sin motivo.
 */
export const displayFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
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
  // Decorativa y de uso puntual: no merece estar en la cola de la primera
  // pintura. Se descarga cuando alguna regla la pide de verdad.
  preload: false,
});

export const fontVariables = `${displayFont.variable} ${sansFont.variable} ${westernFont.variable}`;
