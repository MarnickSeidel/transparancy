import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/mercado-en-cifras",
        "/explorar",
        "/mapa-de-precios",
        "/cuanto-vale-mi-casa",
        "/analizar-anuncio",
        "/bajadas-de-precio",
        "/anuncio/",
        "/correo/",
        "/r/",
        "/es/",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
