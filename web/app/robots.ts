import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/explore",
        "/opportunities",
        "/heatmap",
        "/estimate",
        "/cuanto-vale-mi-casa",
        "/analyze-url",
        "/price-drops",
        "/en/dashboard",
        "/en/explore",
        "/en/heatmap",
        "/en/estimate",
        "/en/analyze-url",
        "/en/price-drops",
        "/anuncio/",
        "/en/listing/",
        "/email/",
        "/r/",
        "/es/",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
