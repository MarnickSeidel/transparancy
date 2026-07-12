import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/explore", "/opportunities", "/heatmap", "/estimate", "/analyze-url", "/price-drops"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
