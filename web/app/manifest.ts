import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LupaCasa",
    short_name: "LupaCasa",
    description:
      "Colombian real estate market intelligence — price/m² by neighborhood from Finca Raíz data.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5f2",
    theme_color: "#c45c26",
    icons: [
      {
        src: "/branding/CasasClaras-mark.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  };
}
