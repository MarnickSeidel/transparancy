import type { MetadataRoute } from "next";

import { listPublishableZones } from "@/lib/listPublishableZones";
import { absoluteUrl } from "@/lib/siteUrl";

/** Zone list comes from Postgres — generate on each request, not at build time. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/zones"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];

  let zonePages: MetadataRoute.Sitemap = [];
  try {
    const zones = await listPublishableZones();
    zonePages = zones.map((z) => ({
      url: absoluteUrl(
        `/zones/${encodeURIComponent(z.citySlug)}/${encodeURIComponent(z.zoneSlug)}`,
      ),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch (e) {
    console.error("sitemap: could not list zones", e);
  }

  return [...staticPages, ...zonePages];
}
