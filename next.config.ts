import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Necesario para la imagen Docker que se despliega en Coolify.
  output: "standalone",

  poweredByHeader: false,
  compress: true,

  images: {
    // Los archivos subidos desde el CMS se sirven por /uploads/*
    //
    // Solo WebP, sin AVIF. Medido con sharp sobre una imagen de 2400px como
    // las que guarda el CMS: a 1920px, AVIF tarda 2792 ms y pesa 11 KB;
    // WebP tarda 185 ms y pesa 10 KB. Quince veces mas de CPU por un archivo
    // que no es mas chico — y el origen ya es WebP, asi que AVIF no tiene de
    // donde ganar. Ese trabajo lo paga el servidor la primera vez que alguien
    // pide cada tamaño, mientras la pagina espera.
    formats: ["image/webp"],
    // Escalera fina a proposito. Cada escalon que falta empuja al navegador al
    // siguiente hacia arriba: sin el de 1200, un telefono de 390 puntos con
    // pantalla x3 —que pide 1170— termina bajando el de 1600, un 60% mas de
    // datos en la imagen mas grande de la pagina. Codificar de mas es barato
    // ahora que no hay AVIF; bajar de mas lo paga el cliente en cada visita.
    deviceSizes: [360, 480, 640, 828, 1080, 1200, 1600, 1920, 2560],
    imageSizes: [64, 96, 128, 200, 256, 384, 512],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  experimental: {
    serverActions: {
      // Las subidas de imagenes del CMS viajan por Server Actions.
      bodySizeLimit: "12mb",
    },
  },

  // sharp y el driver de Postgres son nativos: no deben empaquetarse.
  serverExternalPackages: ["sharp", "@prisma/adapter-pg", "pg"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), microphone=(), payment=()",
          },
        ],
      },
      {
        // Los archivos subidos llevan nombre con hash: se pueden cachear fuerte.
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },

      /*
       * Paginas publicas: cacheables en el borde, nunca en el navegador.
       *
       * El HTML se arma en cada visita contra la base de datos. Medido contra
       * produccion, eso son entre 0,3 y 0,5 s de servidor —con picos de varios
       * segundos cuando la maquina esta ocupada—, y encima el visitante en
       * Chile paga la ida y vuelta hasta el servidor.
       *
       * `s-maxage` deja que Cloudflare guarde el HTML un minuto y lo sirva
       * desde su nodo mas cercano: el telefono recibe la pagina sin esperar al
       * servidor. `stale-while-revalidate` hace que, pasado ese minuto, se siga
       * entregando la version guardada mientras se pide una fresca por detras,
       * asi nadie espera nunca por la regeneracion.
       *
       * `max-age=0` mantiene el navegador siempre al dia: el cache es del
       * borde, no del dispositivo. Un cambio en el CMS tarda como mucho un
       * minuto en verse, o se ve al instante purgando el cache en Cloudflare.
       *
       * Solo estas rutas. El panel, la app de sala y todo /barzucard leen
       * cookies de sesion y no deben cachearse en ningun lado.
       */
      {
        source:
          "/:path(|eventos|carta|nosotros|galeria|ubicacion|contacto|legales)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
          },
        ],
      },
      {
        source: "/eventos/:slug",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
