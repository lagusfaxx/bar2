import { Playfair_Display, Rye } from "next/font/google";

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

/*
 * Para el texto corriente NO se descarga tipografia: se usa la del sistema
 * (Roboto en Android, San Francisco en iPhone). Eran 47 KB precargados en
 * cada visita —el archivo mas pesado del camino critico— para una sans neutra
 * que en pantalla chica es indistinguible de la nativa. La identidad del
 * sitio vive en Playfair (titulos) y Rye (acentos), que se conservan.
 * La pila de reserva esta en globals.css (--font-sans).
 */

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

export const fontVariables = `${displayFont.variable} ${westernFont.variable}`;
