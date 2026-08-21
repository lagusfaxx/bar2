/**
 * Carga la carta del local en la base.
 *
 * Es lo que hay que correr cuando cambia la carta impresa: deja la web, la
 * carta del QR de la mesa y el POS de sala mostrando exactamente lo que está
 * en `prisma/carta.ts`.
 *
 *   npm run carta:cargar
 *
 * Se puede correr sobre la base del local, con contenido real y con la noche
 * andando. A diferencia del seed —que carga contenido de demostración y por eso
 * se niega a correr dos veces— esto no toca nada más que la carta: ni la
 * portada, ni la cartelera, ni la galería, ni los usuarios del panel.
 *
 * Qué hace, exactamente:
 *
 * - Crea o actualiza cada categoría y cada producto por su slug (nombre,
 *   descripción, precio, orden y foto).
 * - Retira, por slug, lo que quedó de la carta anterior. Nunca borra "todo lo
 *   que no esté en la lista": lo que el local haya cargado desde el panel sigue
 *   donde está.
 * - No toca las cuentas abiertas: cada línea de una cuenta guarda su propia
 *   copia del nombre y del precio, así que lo ya pedido se sigue cobrando como
 *   se pidió.
 *
 * Con `--ver` no escribe nada: solo imprime la carta que cargaría.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { aplicarCarta, CARTA, slugDeProducto } from "../prisma/carta";
import { PrismaClient } from "../src/generated/prisma/client";

const precio = (cents: number) =>
  `$${(cents / 100).toLocaleString("es-CL", { maximumFractionDigits: 0 })}`;

function mostrarCarta() {
  for (const category of CARTA) {
    console.log(`\n${category.name}`);
    for (const product of category.products) {
      console.log(
        `  ${product.name.padEnd(38)} ${precio(product.price).padStart(9)}  ${slugDeProducto(
          category.slug,
          product.name,
        )}`,
      );
    }
  }
}

async function main() {
  const productos = CARTA.reduce((total, c) => total + c.products.length, 0);

  if (process.argv.includes("--ver")) {
    mostrarCarta();
    console.log(
      `\n${CARTA.length} categorías, ${productos} productos. No se escribió nada.`,
    );
    return;
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("Cargando la carta…");
    const resultado = await aplicarCarta(prisma);

    console.log(
      `· ${resultado.categorias} categorías y ${resultado.productos} productos`,
    );

    if (resultado.retirados.categorias > 0 || resultado.retirados.productos > 0) {
      console.log(
        `· Carta anterior retirada: ${resultado.retirados.categorias} categorías y ${resultado.retirados.productos} productos`,
      );
    }

    console.log("\nListo. La web, el QR de la mesa y el POS ya muestran esta carta.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("\nNo se pudo cargar la carta:", error);
  process.exit(1);
});
