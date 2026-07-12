import type { MetadataRoute } from "next";

import { localePath } from "@/lib/locale";
import { listPublishableCitySlugs, listPublishableZones } from "@/lib/listPublishableZones";
import { absoluteUrl } from "@/lib/siteUrl";

/** Zone list comes from Postgres — generate on each request, not at build time. */
export const dynamic = "force-dynamic";

const TRUST_PATHS = ["/methodology", "/privacy", "/about"];

function entry(
  path: string,
  locale: "es" | "en",
  lastModified: Date,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"] = "weekly",
): MetadataRoute.Sitemap[0] {
  return {
    url: absoluteUrl(localePath(locale, path)),
    lastModified,
    changeFrequency,
    priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    entry("/", "es", now, 1, "daily"),
    entry("/", "en", now, 1, "daily"),
    entry("/zones", "es", now, 0.9, "daily"),
    entry("/zones", "en", now, 0.9, "daily"),
  ];

  for (const path of TRUST_PATHS) {
    pages.push(entry(path, "es", now, 0.5, "monthly"));
    pages.push(entry(path, "en", now, 0.5, "monthly"));
  }

  try {
    const cities = await listPublishableCitySlugs();
    for (const c of cities) {
      const path = `/zones/${encodeURIComponent(c.citySlug)}`;
      pages.push(entry(path, "es", now, 0.85, "weekly"));
      pages.push(entry(path, "en", now, 0.85, "weekly"));
    }

    const zones = await listPublishableZones();
    for (const z of zones) {
      const path = `/zones/${encodeURIComponent(z.citySlug)}/${encodeURIComponent(z.zoneSlug)}`;
      const mod = z.updatedAt ?? now;
      pages.push(entry(path, "es", mod, 0.8, "weekly"));
      pages.push(entry(path, "en", mod, 0.8, "weekly"));
    }
  } catch (e) {
    console.error("sitemap: could not list zones", e);
  }

  return pages;
}
