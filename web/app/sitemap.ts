import type { MetadataRoute } from "next";

import { localePath, opportunitiesPath } from "@/lib/locale";
import { listPublishableCitySlugs, listPublishableZones } from "@/lib/listPublishableZones";
import { absoluteUrl } from "@/lib/siteUrl";

/** Zone list comes from Postgres — generate on each request, not at build time. */
export const dynamic = "force-dynamic";

const TRUST_PATHS = ["/methodology", "/privacy", "/about"];

function languageAlternates(path: string): Record<string, string> {
  const es = absoluteUrl(localePath("es", path));
  return {
    es,
    "x-default": es,
  };
}

function entry(
  path: string,
  lastModified: Date,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"] = "weekly",
): MetadataRoute.Sitemap[0] {
  return {
    url: absoluteUrl(localePath("es", path)),
    lastModified,
    changeFrequency,
    priority,
    alternates: {
      languages: languageAlternates(path),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const opportunitiesEs = absoluteUrl(opportunitiesPath("es"));
  const opportunitiesLanguages = {
    es: opportunitiesEs,
    "x-default": opportunitiesEs,
  };

  const pages: MetadataRoute.Sitemap = [
    entry("/", now, 1, "daily"),
    entry("/zones", now, 0.9, "daily"),
    {
      url: opportunitiesEs,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
      alternates: { languages: opportunitiesLanguages },
    },
  ];

  for (const path of TRUST_PATHS) {
    pages.push(entry(path, now, 0.5, "monthly"));
  }

  try {
    const cities = await listPublishableCitySlugs();
    for (const c of cities) {
      const path = `/zones/${encodeURIComponent(c.citySlug)}`;
      pages.push(entry(path, now, 0.85, "weekly"));
    }

    const zones = await listPublishableZones();
    for (const z of zones) {
      const path = `/zones/${encodeURIComponent(z.citySlug)}/${encodeURIComponent(z.zoneSlug)}`;
      const mod = z.updatedAt ?? now;
      pages.push(entry(path, mod, 0.8, "weekly"));
    }
  } catch (e) {
    console.error("sitemap: could not list zones", e);
  }

  return pages;
}
