import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Necesario para la imagen Docker que se despliega en Coolify.
  output: "standalone",

  poweredByHeader: false,
  compress: true,

  images: {
    // Los archivos subidos desde el CMS se sirven por /uploads/*
    formats: ["image/avif", "image/webp"],
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
    ];
  },
};

export default nextConfig;
