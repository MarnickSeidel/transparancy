import { Fraunces, Source_Sans_3 } from "next/font/google";
import localFont from "next/font/local";
import { headers } from "next/headers";
import type { Viewport } from "next";

import NavigationProgressRoot from "@/app/components/NavigationProgressRoot";
import { rootMetadata, siteViewport } from "@/lib/seo";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata = rootMetadata();

export const viewport: Viewport = siteViewport;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const langHeader = headers().get("x-document-lang");
  const lang = langHeader === "en" ? "en" : "es";

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("ui_theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${fraunces.variable} ${sourceSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <a href="#main-content" className="skip-link">
          {lang === "en" ? "Skip to content" : "Saltar al contenido"}
        </a>
        <NavigationProgressRoot />
        {children}
      </body>
    </html>
  );
}
