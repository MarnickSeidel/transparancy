import type { Metadata } from "next";

import { absoluteUrl } from "@/lib/siteUrl";

export const defaultSiteMetadata = {
  siteName: "Habidata",
  defaultTitle: "Habidata — Inteligencia inmobiliaria con datos en Colombia",
  defaultDescription:
    "Analítica de publicaciones Finca Raíz: precio/m² por barrio, oportunidades infravaloradas, mapas y estimadores para inversionistas en Colombia.",
};

export function rootMetadata(): Metadata {
  const url = absoluteUrl("/");
  const { defaultTitle, defaultDescription, siteName } = defaultSiteMetadata;

  return {
    metadataBase: new URL(getSiteUrlFromEnv()),
    title: {
      default: defaultTitle,
      template: "%s | Habidata",
    },
    description: defaultDescription,
    alternates: { canonical: url },
    openGraph: {
      title: defaultTitle,
      description: defaultDescription,
      url,
      siteName,
      locale: "es_CO",
      type: "website",
      images: [{ url: absoluteUrl("/branding/habidata-logo-horizontal.png") }],
    },
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description: defaultDescription,
      images: [absoluteUrl("/branding/habidata-mark.png")],
    },
    icons: {
      icon: "/branding/habidata-mark.png",
      shortcut: "/branding/habidata-mark.png",
      apple: "/branding/habidata-mark.png",
    },
  };
}

function getSiteUrlFromEnv(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "http://localhost:3000";
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

/** Tool/dashboard routes: thin CSR shells — keep out of index until SSR content exists. */
export function noIndexMetadata(title: string, description?: string): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: true },
  };
}

export function homeMetadata(): Metadata {
  const title = "Habidata — Detecta propiedades infravaloradas en Colombia";
  const description =
    "Plataforma de datos inmobiliarios: precio/m² por barrio, scoring de oportunidades, heatmaps y estimador basado en publicaciones Finca Raíz.";
  const url = absoluteUrl("/");
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: defaultSiteMetadata.siteName,
      locale: "es_CO",
      type: "website",
    },
    twitter: { card: "summary", title, description },
  };
}
