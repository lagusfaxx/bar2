import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Ni el panel ni el area privada de socios deben indexarse. La carta de
      // la mesa tampoco: es la unica con precios y se llega a ella por el QR
      // de la mesa, no desde un buscador.
      disallow: [
        "/admin",
        "/staff",
        "/api/",
        "/barzucard/tarjeta",
        "/carta/mesa",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
