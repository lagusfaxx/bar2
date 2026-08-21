/**
 * La carta de BARZUO: la de verdad, la que está sobre las mesas.
 *
 * Es una sola lista y la leen los tres lugares donde aparece la carta, que por
 * eso nunca se contradicen:
 *
 * - `/carta`, la pública de la web, sin precios;
 * - `/carta/mesa`, la del QR de la mesa, con precios;
 * - el POS de sala, donde el garzón carga lo que se pide.
 *
 * Vive aquí y no dentro del seed porque cambiar la carta y sembrar contenido de
 * demostración son dos cosas distintas: el seed se corre una vez, al levantar
 * el proyecto, y se niega a correr sobre una base con contenido real. La carta,
 * en cambio, cambia cuando cambia la carta impresa. Para eso está
 * `npm run carta:cargar`, que aplica solo esto.
 *
 * Los precios van en centésimos de peso (un producto de $6.600 se escribe
 * 660000), igual que `MenuProduct.priceCents`.
 */
import type { PrismaClient } from "../src/generated/prisma/client";

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** El slug con el que se guarda un producto de la carta. */
export function slugDeProducto(categorySlug: string, productName: string) {
  return `${categorySlug}-${slugify(productName)}`;
}

export type CartaCategoria = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  image: number;
  products: Array<{
    name: string;
    description: string;
    price: number;
    featured?: boolean;
    image?: number;
    tags?: string[];
  }>;
};

export const CARTA: CartaCategoria[] = [
  {
    slug: "empanadas",
    name: "Empanadas",
    description:
      "Porciones de ocho unidades, recien fritas. Todas vienen con la salsa del chef.",
    icon: "Croissant",
    image: 1,
    products: [
      {
        name: "Empanadas de queso",
        description: "Ocho unidades. Con salsa del chef.",
        price: 660000,
        image: 1,
      },
      {
        name: "Empanadas de queso y aceituna",
        description: "Ocho unidades. Con salsa del chef.",
        price: 850000,
      },
      {
        name: "Empanadas de queso y champiñón",
        description: "Ocho unidades. Con salsa del chef.",
        price: 850000,
      },
      {
        name: "Empanadas de queso, camarón y ciboulette",
        description: "Ocho unidades. Con salsa del chef.",
        price: 950000,
        featured: true,
      },
    ],
  },
  {
    slug: "quesadillas",
    name: "Quesadillas",
    description: "A la plancha, para compartir. Todas vienen con la salsa del chef.",
    icon: "Pizza",
    image: 2,
    products: [
      {
        name: "Quesadilla de pollo",
        description: "Pollo, champiñón y pimentón.",
        price: 899000,
      },
      {
        name: "Quesadilla de carne",
        description: "Carne, champiñón y pimentón.",
        price: 1099000,
        image: 2,
      },
      {
        name: "Quesadilla de camarón",
        description: "Camarón, aceitunas y pimentón.",
        price: 1299000,
      },
    ],
  },
  {
    slug: "charcuteria-y-frituras",
    name: "Charcutería y frituras",
    description: "Lo que se pide apenas llega la mesa, mientras arranca la noche.",
    icon: "Utensils",
    image: 3,
    products: [
      {
        name: "Tabla de charcutería",
        description:
          "Queso, salame, jamón, aceitunas, galletas, tostadas y frutos secos. Con salsa del chef.",
        price: 1050000,
        featured: true,
        image: 3,
      },
      {
        name: "Porción de papas fritas",
        description: "Cortadas y fritas en el momento.",
        price: 700000,
      },
      {
        name: "Chorrillana clásica",
        description:
          "Carne, 700 gramos de papas fritas, cebolla caramelizada, vianesas, longanizas y huevo.",
        price: 1399000,
        featured: true,
        image: 4,
      },
      {
        name: "Chorrillana vegetariana",
        description:
          "Pimentón rojo, verde y amarillo, cebolla caramelizada, champiñón, callampas deshidratadas y crema.",
        price: 1399000,
        tags: ["vegetariano"],
      },
    ],
  },
  {
    slug: "churrascos",
    name: "Churrascos",
    description: "Carne de res a la plancha en pan crujiente, con papas fritas.",
    icon: "Sandwich",
    image: 4,
    products: [
      {
        name: "Chacarero",
        description:
          "Jugosa carne de res a la plancha con tomate, porotos verdes y ají verde. Acompañado de papas fritas.",
        price: 1299000,
        image: 5,
      },
      {
        name: "Luco",
        description:
          "Jugosa carne de res a la plancha con queso derretido en un pan crujiente. Acompañado de papas fritas.",
        price: 1299000,
      },
      {
        name: "Italiano",
        description:
          "Jugosa carne de res a la plancha cubierta con palta, tomate y mayonesa. Acompañado de papas fritas.",
        price: 1299000,
      },
    ],
  },
  {
    slug: "hamburguesas",
    name: "Hamburguesas",
    description: "Todas se sirven con papas fritas.",
    icon: "Beef",
    image: 5,
    products: [
      {
        name: "Hamburguesa italiana",
        description: "Tomate fresco, palta y mayo. Acompañada de papas fritas.",
        price: 1199000,
        featured: true,
        image: 6,
      },
      {
        name: "Hamburguesa luco",
        description: "Queso derretido. Acompañada de papas fritas.",
        price: 1199000,
      },
      {
        name: "Hamburguesa vegetariana",
        description:
          "Carne de soya, tomate, palta y notmayo. Acompañada de papas fritas.",
        price: 1199000,
        tags: ["vegetariano"],
      },
    ],
  },
  {
    slug: "pizzas-a-la-piedra",
    name: "Pizzas a la piedra",
    description: "Masa fina, horneada sobre piedra.",
    icon: "Pizza",
    image: 6,
    products: [
      {
        name: "Pizza pepperoni",
        description: "Pepperoni, aceitunas, queso y salsa pomodoro.",
        price: 1350000,
        featured: true,
        image: 7,
      },
      {
        name: "Pizza jamón serrano",
        description: "Rúcula, jamón serrano, queso y salsa pomodoro.",
        price: 1350000,
      },
      {
        name: "Pizza champiñón",
        description: "Champiñones, aceitunas, queso y salsa pomodoro.",
        price: 1350000,
      },
      {
        name: "Pizza carne mechada",
        description: "Carne mechada, queso, palta y salsa pomodoro.",
        price: 1350000,
      },
    ],
  },
  {
    slug: "cortos-de-whisky",
    name: "Cortos de whisky",
    description: "Todos los cortos incluyen bebida.",
    icon: "GlassWater",
    image: 7,
    products: [
      {
        name: "Jack Daniel's",
        description: "Corto. Incluye bebida.",
        price: 850000,
        image: 8,
      },
      {
        name: "Johnnie Walker etiqueta negra",
        description: "Corto. Incluye bebida.",
        price: 899000,
        featured: true,
      },
      {
        name: "Johnnie Walker etiqueta roja",
        description: "Corto. Incluye bebida.",
        price: 850000,
      },
      {
        name: "Ballantine's",
        description: "Corto. Incluye bebida.",
        price: 750000,
      },
    ],
  },
  {
    slug: "combinados-de-pisco",
    name: "Combinados de pisco",
    description: "Todos los combinados incluyen bebida.",
    icon: "CupSoda",
    image: 8,
    products: [
      {
        name: "Pisco Mistral 35°",
        description: "Combinado. Incluye bebida.",
        price: 650000,
      },
      {
        name: "Pisco Mistral 40°",
        description: "Combinado. Incluye bebida.",
        price: 750000,
      },
      {
        name: "Pisco Alto del Carmen 35°",
        description: "Combinado. Incluye bebida.",
        price: 650000,
      },
      {
        name: "Pisco Alto del Carmen 40°",
        description: "Combinado. Incluye bebida.",
        price: 750000,
      },
    ],
  },
  {
    slug: "gin",
    name: "Gin + bebida",
    description: "Servidos en copa alta, con hielo y el garnish de la casa.",
    icon: "Martini",
    image: 9,
    products: [
      { name: "Gin Gora", description: "Con bebida.", price: 750000 },
      { name: "Gin Beefeater", description: "Con bebida.", price: 750000 },
      { name: "Gin Tanqueray", description: "Con bebida.", price: 850000 },
      {
        name: "Gin tropical",
        description: "Gin, Red Bull tropical y sabor a elección.",
        price: 900000,
        featured: true,
        image: 9,
      },
    ],
  },
  {
    slug: "promos-de-la-barra",
    name: "Promos de la barra",
    description:
      "Dos cortos y la bebida, para la mesa que se queda hasta el final del show.",
    icon: "Sparkles",
    image: 10,
    products: [
      {
        name: "Promo Mistral 35°",
        description: "Dos cortos + bebida.",
        price: 1000000,
      },
      {
        name: "Promo Pisco Alto del Carmen 35°",
        description: "Dos cortos + bebida.",
        price: 1000000,
      },
      {
        name: "Promo Pisco Alto del Carmen 40°",
        description: "Dos cortos + bebida.",
        price: 1050000,
      },
      {
        name: "Promo Johnnie Walker etiqueta roja",
        description: "Dos cortos + bebida.",
        price: 1350000,
      },
      {
        name: "Promo Ballantine's",
        description: "Dos cortos + bebida.",
        price: 1099000,
      },
      {
        name: "Promo ron Barceló",
        description: "Un corto de ron Barceló + bebida.",
        price: 650000,
      },
      {
        name: "Promo doble ron Barceló",
        description: "Dos cortos de ron Barceló + bebida.",
        price: 1350000,
      },
      {
        name: "Promo Gin Gora",
        description: "Dos cortos + bebida o tónica.",
        price: 1700000,
        featured: true,
        image: 10,
      },
    ],
  },
  {
    slug: "cocteleria",
    name: "Coctelería",
    description: "Los clásicos de siempre, preparados a la vista en la barra.",
    icon: "Martini",
    image: 11,
    products: [
      { name: "Caipirinha", description: "Cachaça, lima y azúcar.", price: 600000 },
      { name: "Ramazzotti", description: "Amaro italiano, con hielo.", price: 700000 },
      { name: "Campari Spritz", description: "Campari, espumante y soda.", price: 750000 },
      { name: "Daiquiri", description: "Ron, lima y azúcar.", price: 650000 },
      {
        name: "Daiquiri de sabores",
        description: "Frambuesa, piña, frutilla, arándano, mango, papaya o maracuyá.",
        price: 700000,
      },
      { name: "Mojito", description: "Ron, menta, lima y soda.", price: 650000 },
      {
        name: "Mojito de sabores",
        description: "Frambuesa, piña, frutilla, arándano, mango, papaya o maracuyá.",
        price: 700000,
      },
      {
        name: "Pisco Sour Catedral",
        description: "La versión de la casa, con pisco de 40°.",
        price: 750000,
        featured: true,
        image: 11,
      },
      { name: "Pisco Sour", description: "Pisco, limón de pica y azúcar.", price: 650000 },
      { name: "Piña Colada", description: "Ron, piña y crema de coco.", price: 650000 },
      { name: "Aperol Spritz", description: "Aperol, espumante y soda.", price: 700000 },
      { name: "Tequila Margarita", description: "Tequila, triple sec y lima.", price: 600000 },
      { name: "Tequila Sunrise", description: "Tequila, naranja y granadina.", price: 650000 },
      { name: "Pink Margarita", description: "Margarita con frutos rojos.", price: 650000 },
      { name: "Tom Collins", description: "Gin, limón, azúcar y soda.", price: 650000 },
      { name: "John Collins", description: "Whisky, limón, azúcar y soda.", price: 750000 },
      { name: "Ruso Blanco", description: "Vodka, licor de café y crema.", price: 650000 },
      { name: "Ruso Negro", description: "Vodka y licor de café.", price: 650000 },
      { name: "Vodka Naranja", description: "Vodka y jugo de naranja.", price: 600000 },
      { name: "Sangría", description: "Vino tinto y frutas.", price: 550000 },
      {
        name: "Whisky Sour",
        description: "Whisky, limón y azúcar.",
        price: 850000,
        featured: true,
      },
      { name: "Fernet con bebida", description: "Fernet y bebida cola.", price: 650000 },
      { name: "Moscow Mule", description: "Vodka, ginger beer y lima.", price: 650000 },
    ],
  },
  {
    slug: "cervezas",
    name: "Cervezas",
    description:
      "Schop tirado y botellas bien frías. Cada una va sola, chelada o michelada.",
    icon: "Beer",
    image: 12,
    products: [
      {
        name: "Schop Kunstmann",
        description: "Schop tirado de barril.",
        price: 570000,
        featured: true,
        image: 12,
      },
      {
        name: "Schop Kunstmann chelada",
        description: "Con limón y sal en el borde del vaso.",
        price: 650000,
      },
      {
        name: "Schop Kunstmann michelada",
        description: "Con limón, sal y las salsas de la casa.",
        price: 670000,
      },
      {
        name: "Schop Heineken",
        description: "Schop tirado de barril.",
        price: 450000,
      },
      {
        name: "Schop Heineken chelada",
        description: "Con limón y sal en el borde del vaso.",
        price: 530000,
      },
      {
        name: "Schop Heineken michelada",
        description: "Con limón, sal y las salsas de la casa.",
        price: 550000,
      },
      {
        name: "Royal Guard",
        description: "Bien fría.",
        price: 350000,
      },
      {
        name: "Royal Guard chelada",
        description: "Con limón y sal en el borde del vaso.",
        price: 430000,
      },
      {
        name: "Royal Guard michelada",
        description: "Con limón, sal y las salsas de la casa.",
        price: 450000,
      },
      {
        name: "Corona",
        description: "Bien fría.",
        price: 350000,
      },
      {
        name: "Corona chelada",
        description: "Con limón y sal en el borde del vaso.",
        price: 430000,
      },
      {
        name: "Corona michelada",
        description: "Con limón, sal y las salsas de la casa.",
        price: 450000,
      },
    ],
  },
  {
    slug: "vinos",
    name: "Vinos",
    description: "Botellas de gran reserva y reserva, seleccionadas para la mesa.",
    icon: "Wine",
    image: 13,
    products: [
      {
        name: "Santa Ema",
        description: "Gran reserva. Botella.",
        price: 1800000,
        featured: true,
        image: 13,
      },
      {
        name: "Pérez Cruz",
        description: "Gran reserva. Botella.",
        price: 1800000,
      },
      {
        name: "Casillero del Diablo",
        description: "Reserva. Botella.",
        price: 1300000,
      },
      {
        name: "Doña Dominga",
        description: "Reserva. Botella.",
        price: 1300000,
      },
      {
        name: "Undurraga Brut",
        description: "Reserva. Espumante. Botella.",
        price: 1300000,
      },
    ],
  },
  {
    slug: "sin-alcohol",
    name: "Sin alcohol",
    description:
      "Cervezas y coctelería sin alcohol, con la misma preparación de barra. Las cervezas también van cheladas o micheladas.",
    icon: "GlassWater",
    image: 14,
    products: [
      {
        name: "Mahou 0,0 (lata)",
        description: "Sin alcohol.",
        price: 350000,
        tags: ["sin alcohol"],
      },
      {
        name: "Mahou 0,0 (lata) chelada",
        description: "Sin alcohol. Con limón y sal en el borde del vaso.",
        price: 430000,
        tags: ["sin alcohol"],
      },
      {
        name: "Mahou 0,0 (lata) michelada",
        description: "Sin alcohol. Con limón, sal y las salsas de la casa.",
        price: 470000,
        tags: ["sin alcohol"],
      },
      {
        name: "Mahou 0,0 (botellín)",
        description: "Sin alcohol.",
        price: 400000,
        tags: ["sin alcohol"],
      },
      {
        name: "Mahou 0,0 (botellín) chelada",
        description: "Sin alcohol. Con limón y sal en el borde del vaso.",
        price: 480000,
        tags: ["sin alcohol"],
      },
      {
        name: "Mahou 0,0 (botellín) michelada",
        description: "Sin alcohol. Con limón, sal y las salsas de la casa.",
        price: 520000,
        tags: ["sin alcohol"],
      },
      {
        name: "Royal 0,0 (botellín)",
        description: "Sin alcohol.",
        price: 400000,
        tags: ["sin alcohol"],
      },
      {
        name: "Royal 0,0 (botellín) chelada",
        description: "Sin alcohol. Con limón y sal en el borde del vaso.",
        price: 480000,
        tags: ["sin alcohol"],
      },
      {
        name: "Royal 0,0 (botellín) michelada",
        description: "Sin alcohol. Con limón, sal y las salsas de la casa.",
        price: 520000,
        tags: ["sin alcohol"],
      },
      {
        name: "Cristal 0,0 (botellín)",
        description: "Sin alcohol.",
        price: 400000,
        tags: ["sin alcohol"],
      },
      {
        name: "Cristal 0,0 (botellín) chelada",
        description: "Sin alcohol. Con limón y sal en el borde del vaso.",
        price: 480000,
        tags: ["sin alcohol"],
      },
      {
        name: "Cristal 0,0 (botellín) michelada",
        description: "Sin alcohol. Con limón, sal y las salsas de la casa.",
        price: 520000,
        tags: ["sin alcohol"],
      },
      {
        name: "Corona 0,0 (botellín)",
        description: "Sin alcohol.",
        price: 400000,
        tags: ["sin alcohol"],
      },
      {
        name: "Corona 0,0 (botellín) chelada",
        description: "Sin alcohol. Con limón y sal en el borde del vaso.",
        price: 480000,
        tags: ["sin alcohol"],
      },
      {
        name: "Corona 0,0 (botellín) michelada",
        description: "Sin alcohol. Con limón, sal y las salsas de la casa.",
        price: 520000,
        tags: ["sin alcohol"],
      },
      {
        name: "Heineken 0,0 (botellín)",
        description: "Sin alcohol.",
        price: 400000,
        tags: ["sin alcohol"],
      },
      {
        name: "Heineken 0,0 (botellín) chelada",
        description: "Sin alcohol. Con limón y sal en el borde del vaso.",
        price: 480000,
        tags: ["sin alcohol"],
      },
      {
        name: "Heineken 0,0 (botellín) michelada",
        description: "Sin alcohol. Con limón, sal y las salsas de la casa.",
        price: 520000,
        tags: ["sin alcohol"],
      },
      {
        name: "Primavera",
        description: "Cóctel sin alcohol de frutas frescas.",
        price: 500000,
        tags: ["sin alcohol"],
      },
      {
        name: "Piña colada sin alcohol",
        description: "Piña y crema de coco.",
        price: 500000,
        tags: ["sin alcohol"],
      },
      {
        name: "Frambuesa colada",
        description: "Frambuesa, piña y crema de coco.",
        price: 550000,
        tags: ["sin alcohol"],
      },
      {
        name: "Daiquiri de sabor sin alcohol",
        description: "Frambuesa, piña, frutilla, arándano, mango, papaya o maracuyá.",
        price: 500000,
        tags: ["sin alcohol"],
      },
      {
        name: "Mojito sin alcohol",
        description: "Menta, lima y soda.",
        price: 550000,
        tags: ["sin alcohol"],
      },
      {
        name: "Mojito de sabores sin alcohol",
        description: "Frambuesa, piña, frutilla, arándano, mango, papaya o maracuyá.",
        price: 600000,
        tags: ["sin alcohol"],
      },
    ],
  },
  {
    slug: "bebidas-y-jugos",
    name: "Bebidas y jugos",
    description: "Para acompañar la mesa o cortar un trago.",
    icon: "CupSoda",
    image: 15,
    products: [
      { name: "Coca-Cola", description: "Normal.", price: 250000, tags: ["sin alcohol"] },
      { name: "Coca-Cola Zero", description: "Sin azúcar.", price: 250000, tags: ["sin alcohol"] },
      { name: "Sprite", description: "Normal.", price: 250000, tags: ["sin alcohol"] },
      { name: "Sprite Zero", description: "Sin azúcar.", price: 250000, tags: ["sin alcohol"] },
      { name: "Fanta", description: "Normal.", price: 250000, tags: ["sin alcohol"] },
      { name: "Agua tónica", description: "Para cortar gin o pisco.", price: 250000, tags: ["sin alcohol"] },
      { name: "Red Bull", description: "Lata.", price: 350000, tags: ["sin alcohol"] },
      { name: "Score", description: "Lata.", price: 350000, tags: ["sin alcohol"] },
      {
        name: "Jugos naturales",
        description: "Frambuesa, frutilla, piña, papaya, arándano, maracuyá o mango.",
        price: 350000,
        tags: ["sin alcohol"],
      },
      { name: "Limonada", description: "Recién exprimida.", price: 300000, tags: ["sin alcohol"] },
      {
        name: "Limonada de menta y jengibre",
        description: "Con menta fresca y jengibre.",
        price: 350000,
        featured: true,
        image: 14,
        tags: ["sin alcohol"],
      },
      { name: "Agua mineral", description: "Con o sin gas.", price: 250000, tags: ["sin alcohol"] },
    ],
  },
];

/**
 * Qué se prepara en la barra y qué en la cocina.
 *
 * Es el reparto de las comandas: cada categoría nace apuntando a una estación y
 * cada producto puede desviarse (ver `MenuProduct.station`).
 *
 * Hay una migración que hace este mismo reparto, pero solo alcanza a las cartas
 * que ya existían cuando se aplicó: en una instalación nueva las categorías se
 * crean aquí *después*, y nacían todas en COCINA. El resultado era que las
 * cervezas y los tragos se imprimían en la comanda de cocina y la barra no
 * recibía nada — justo lo contrario de tener dos comandas separadas.
 *
 * Solo se aplica al crear la categoría: si el local ya la movió desde el panel,
 * cargar la carta no le pisa la decisión.
 */
const CATEGORIAS_DE_BARRA = new Set([
  "cortos-de-whisky",
  "combinados-de-pisco",
  "gin",
  "promos-de-la-barra",
  "cocteleria",
  "cervezas",
  "vinos",
  "sin-alcohol",
  "bebidas-y-jugos",
]);

export function stationFor(slug: string) {
  return CATEGORIAS_DE_BARRA.has(slug) ? "BARRA" : "COCINA";
}

/**
 * Restos de la carta de demostración anterior.
 *
 * Al reemplazarla por la carta real quedaron categorías que ya no existen y,
 * dentro de las que sí, productos inventados mezclados con los de verdad.
 * Cargar la carta hace upsert, no borra: sin esta limpieza una base cargada
 * antes mostraría las dos cartas a la vez.
 *
 * Se enumeran los slugs exactos a propósito. Borrar "todo lo que no esté en
 * CARTA" arrasaría con lo que el local haya cargado después desde el panel.
 */
const CATEGORIAS_RETIRADAS = [
  "cocteleria-de-autor",
  "destilados",
  "tablas",
  "cocina",
];

// Se listan las variantes que llegó a tener la carta anterior: la de
// demostración, la localizada a Chile —que renombró varios productos— y las
// cheladas y micheladas, que hasta ahora eran una nota de precio dentro de la
// descripción de la cerveza y ahora son productos que el POS sabe cobrar.
const PRODUCTOS_RETIRADOS = [
  "cervezas-chopp-rubia-500cc",
  "cervezas-chopp-ipa-500cc",
  "cervezas-chopp-negra-500cc",
  "cervezas-cerveza-de-barril-rubia-500cc",
  "cervezas-cerveza-de-barril-ipa-500cc",
  "cervezas-cerveza-de-barril-negra-500cc",
  "cervezas-artesanal-de-la-semana",
  "cervezas-cerveza-en-botella-340cc",
  "cervezas-cerveza-en-botella-330cc",
  "cervezas-cerveza-sin-alcohol",
  "vinos-tannat-reserva-copa",
  "vinos-tannat-reserva-botella",
  "vinos-tinto-reserva-copa",
  "vinos-tinto-reserva-botella",
  "vinos-sauvignon-blanc-copa",
  "vinos-espumante-brut-copa",
  "sin-alcohol-limonada-de-la-casa",
  "sin-alcohol-refrescos",
  "sin-alcohol-gaseosas",
  "sin-alcohol-agua-mineral",
  "sin-alcohol-cafe-expreso",
];

async function retirarCartaAnterior(prisma: PrismaClient) {
  // Las categorías arrastran sus productos por la relación en cascada.
  const categories = await prisma.menuCategory.deleteMany({
    where: { slug: { in: CATEGORIAS_RETIRADAS } },
  });

  const products = await prisma.menuProduct.deleteMany({
    where: { slug: { in: PRODUCTOS_RETIRADOS } },
  });

  return { categorias: categories.count, productos: products.count };
}

/**
 * Deja la base con esta carta.
 *
 * Se puede correr sobre una base con contenido real, y por eso lo hace en este
 * orden y no borrando primero: cada categoría y cada producto se upsertan por
 * su slug —el que existe se actualiza, el que falta se crea— y recién al final
 * se retira lo que quedó de la carta anterior, por slug y nunca por descarte.
 *
 * Lo ya consumido no se toca: `OrderItem` guarda su propia copia del nombre y
 * del precio, así que una cuenta abierta sigue sumando lo mismo aunque el
 * producto cambie de precio o desaparezca de la carta a mitad de la noche.
 */
export async function aplicarCarta(prisma: PrismaClient) {
  for (const [categoryIndex, category] of CARTA.entries()) {
    const saved = await prisma.menuCategory.upsert({
      where: { slug: category.slug },
      create: {
        slug: category.slug,
        name: category.name,
        description: category.description,
        icon: category.icon,
        imageUrl: `/demo/category-${category.image}.jpg`,
        position: categoryIndex,
        station: stationFor(category.slug),
      },
      update: {
        name: category.name,
        description: category.description,
        icon: category.icon,
        imageUrl: `/demo/category-${category.image}.jpg`,
        position: categoryIndex,
        active: true,
      },
    });

    for (const [productIndex, product] of category.products.entries()) {
      const slug = slugDeProducto(category.slug, product.name);
      const data = {
        categoryId: saved.id,
        name: product.name,
        description: product.description,
        priceCents: product.price,
        imageUrl: product.image ? `/demo/product-${product.image}.jpg` : null,
        featured: product.featured ?? false,
        position: productIndex,
        tags: product.tags ?? [],
        available: true,
      };

      await prisma.menuProduct.upsert({
        where: { slug },
        create: { slug, ...data },
        update: data,
      });
    }
  }

  const retirados = await retirarCartaAnterior(prisma);

  return {
    categorias: CARTA.length,
    productos: CARTA.reduce((total, category) => total + category.products.length, 0),
    retirados,
  };
}
