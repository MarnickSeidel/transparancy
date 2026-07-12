import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Habidata",
    short_name: "Habidata",
    description:
      "Colombian real estate market intelligence — price/m² by neighborhood from Finca Raíz data.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0d9488",
    icons: [
      {
        src: "/branding/habidata-mark.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
