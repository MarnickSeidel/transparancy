"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import PageFooter from "./components/PageFooter";
import LanguageToggle from "./components/LanguageToggle";
import ThemeToggle from "./components/ThemeToggle";
import Badge from "./components/ui/Badge";
import Button from "./components/ui/Button";
import Card from "./components/ui/Card";
import type { Lang } from "@/lib/i18n";
import { useUiLang } from "@/lib/useUiLang";
import { useUiTheme } from "@/lib/useUiTheme";

type Content = {
  brandTagline: string;
  badge: string;
  heading: string;
  blurb: string;
  openPlatform: string;
  navDashboard: string;
  navOpportunities: string;
  navExplore: string;
  navHeatmap: string;
  navAnalyze: string;
  navEstimate: string;
  ctaPrimary: string;
  ctaSecondary: string;
  cardsLabel: string;
  highlights: Array<{ label: string; value: string }>;
  features: Array<{ title: string; description: string }>;
  cards: Array<{ zone: string; type: string; value: string; score: string }>;
  statsLoading: string;
  statsListingsLabel: string;
  statsNeighborhoodsLabel: string;
  statsCitiesLabel: string;
};

const content: Record<Lang, Content> = {
  es: {
    brandTagline: "Inteligencia inmobiliaria con datos",
    badge: "Plataforma premium para inversionistas",
    heading: "Detecta propiedades infravaloradas antes que el mercado.",
    blurb:
      "Habidata integra datos de anuncios, contexto geoespacial y scoring de oportunidad en una experiencia de analitica clara y accionable.",
    openPlatform: "Entrar al dashboard",
    navDashboard: "Dashboard",
    navOpportunities: "Oportunidades",
    navExplore: "Explorar",
    navHeatmap: "Mapa H3",
    navAnalyze: "Analizar URL",
    navEstimate: "Estimador",
    ctaPrimary: "Analizar anuncio ahora",
    ctaSecondary: "Calcular precio sugerido",
    cardsLabel: "Vista previa de oportunidades",
    highlights: [
      { label: "Anuncios analizados", value: "…" },
      { label: "Barrios cubiertos", value: "…" },
      { label: "Ciudades activas", value: "…" },
    ],
    statsLoading: "Cargando datos…",
    statsListingsLabel: "Anuncios analizados",
    statsNeighborhoodsLabel: "Barrios cubiertos",
    statsCitiesLabel: "Ciudades activas",
    features: [
      {
        title: "Heatmaps de mercado",
        description:
          "Visualiza zonas de demanda y variacion de precio en capas faciles de interpretar.",
      },
      {
        title: "Scoring de oportunidad",
        description:
          "Prioriza inmuebles con mejor descuento relativo usando comparables locales.",
      },
      {
        title: "Diagnostico express por URL",
        description:
          "Pega un anuncio y recibe contexto de precio, riesgo y potencial en segundos.",
      },
    ],
    cards: [
      { zone: "Chapinero Alto", type: "Apartamento", value: "COP 690M", score: "89/100" },
      { zone: "Cedritos", type: "Casa", value: "COP 980M", score: "84/100" },
      { zone: "Teusaquillo", type: "Apartamento", value: "COP 520M", score: "92/100" },
    ],
  },
  en: {
    brandTagline: "Real estate data intelligence",
    badge: "Premium platform for investors",
    heading: "Spot undervalued properties before the market does.",
    blurb:
      "Habidata combines listing data, geospatial context, and deal scoring into one clear, actionable analytics experience.",
    openPlatform: "Open dashboard",
    navDashboard: "Dashboard",
    navOpportunities: "Opportunities",
    navExplore: "Explore",
    navHeatmap: "H3 map",
    navAnalyze: "Analyze URL",
    navEstimate: "Estimator",
    ctaPrimary: "Analyze listing now",
    ctaSecondary: "Calculate price range",
    cardsLabel: "Opportunity preview",
    highlights: [
      { label: "Listings analyzed", value: "…" },
      { label: "Neighborhoods covered", value: "…" },
      { label: "Active cities", value: "…" },
    ],
    statsLoading: "Loading live data…",
    statsListingsLabel: "Listings analyzed",
    statsNeighborhoodsLabel: "Neighborhoods covered",
    statsCitiesLabel: "Active cities",
    features: [
      {
        title: "Market heatmaps",
        description:
          "Visualize demand zones and price variation with layers that are easy to read.",
      },
      {
        title: "Opportunity scoring",
        description:
          "Prioritize listings with stronger relative discount from local comparables.",
      },
      {
        title: "Instant URL diagnostics",
        description:
          "Paste a listing and get price context, risk, and upside potential in seconds.",
      },
    ],
    cards: [
      { zone: "Chapinero Alto", type: "Apartment", value: "COP 690M", score: "89/100" },
      { zone: "Cedritos", type: "House", value: "COP 980M", score: "84/100" },
      { zone: "Teusaquillo", type: "Apartment", value: "COP 520M", score: "92/100" },
    ],
  },
};

export default function Home() {
  const { lang, toggleLang } = useUiLang("es");
  const { theme, toggleTheme } = useUiTheme("light");
  const darkMode = theme === "dark";
  const txt = useMemo(() => content[lang], [lang]);
  const locale = lang === "es" ? "es-CO" : "en-US";

  const [highlights, setHighlights] = useState(txt.highlights);
  const [cards, setCards] = useState(txt.cards);
  const [statsReady, setStatsReady] = useState(false);

  useEffect(() => {
    setHighlights(txt.highlights);
    setCards(txt.cards);
  }, [txt.highlights, txt.cards]);

  useEffect(() => {
    let cancelled = false;

    async function loadLiveData() {
      try {
        const [summaryRes, oppRes] = await Promise.all([
          fetch("/api/summary"),
          fetch("/api/opportunities"),
        ]);
        if (!summaryRes.ok) return;
        const summary = await summaryRes.json();
        if (cancelled) return;

        setHighlights([
          {
            label: txt.statsListingsLabel,
            value: Number(summary.totalListings ?? 0).toLocaleString(locale),
          },
          {
            label: txt.statsNeighborhoodsLabel,
            value: Number(summary.neighborhoodCount ?? 0).toLocaleString(locale),
          },
          {
            label: txt.statsCitiesLabel,
            value: Number(summary.cityCount ?? 0).toLocaleString(locale),
          },
        ]);
        setStatsReady(true);

        if (oppRes.ok) {
          const oppJson = await oppRes.json();
          const opportunities = (oppJson.opportunities ?? []).slice(0, 3);
          if (!cancelled && opportunities.length > 0) {
            setCards(
              opportunities.map(
                (o: {
                  neighborhood: string | null;
                  city: string;
                  propertyType: string | null;
                  priceCop: string;
                  dealScore: number | null;
                }) => ({
                  zone: o.neighborhood?.trim() || o.city,
                  type: o.propertyType ?? (lang === "es" ? "Inmueble" : "Property"),
                  value: `COP ${Number(String(o.priceCop).replace(/\D/g, "")).toLocaleString(locale)}`,
                  score:
                    o.dealScore != null && Number.isFinite(o.dealScore)
                      ? `${Math.round(o.dealScore)}/100`
                      : "—",
                }),
              ),
            );
          }
        }
      } catch {
        if (!cancelled) setStatsReady(false);
      }
    }

    void loadLiveData();
    return () => {
      cancelled = true;
    };
  }, [lang, locale, txt.statsCitiesLabel, txt.statsListingsLabel, txt.statsNeighborhoodsLabel]);

  return (
    <main
      className={`flex min-h-screen flex-col transition-colors duration-300 ${
        darkMode
          ? "bg-slate-900 text-slate-100"
          : "bg-gradient-to-b from-slate-100 via-slate-50 to-white text-slate-900"
      }`}
    >
      <section className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16 pt-10">
        <header
          className={`mb-14 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 shadow-sm backdrop-blur ${
            darkMode
              ? "border-slate-600 bg-slate-800/85"
              : "border-slate-200/70 bg-white/70"
          }`}
        >
          <div className="flex items-center gap-3">
            {darkMode ? (
              <div className="logo-on-dark">
                <Image
                  src="/branding/habidata-logo-horizontal.png"
                  alt="Habidata"
                  width={210}
                  height={46}
                  className="h-9 w-auto object-contain"
                />
              </div>
            ) : (
              <Image
                src="/branding/habidata-logo-horizontal.png"
                alt="Habidata"
                width={210}
                height={46}
                className="h-9 w-auto object-contain"
              />
            )}
            <p className={darkMode ? "text-sm text-slate-300" : "text-sm text-slate-500"}>
              {txt.brandTagline}
            </p>
          </div>

          <nav
            className={`hidden gap-6 text-sm md:flex ${darkMode ? "text-slate-300" : "text-slate-600"}`}
          >
            <Link href="/dashboard" className="transition hover:text-teal-500">
              {txt.navDashboard}
            </Link>
            <Link href="/opportunities" className="transition hover:text-teal-500">
              {txt.navOpportunities}
            </Link>
            <Link href="/explore" className="transition hover:text-teal-500">
              {txt.navExplore}
            </Link>
            <Link href="/heatmap" className="transition hover:text-teal-500">
              {txt.navHeatmap}
            </Link>
            <Link href="/analyze-url" className="transition hover:text-teal-500">
              {txt.navAnalyze}
            </Link>
            <Link href="/estimate" className="transition hover:text-teal-500">
              {txt.navEstimate}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageToggle lang={lang} onToggle={toggleLang} />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <Link
              href="/dashboard"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
            >
              {txt.openPlatform}
            </Link>
          </div>
        </header>

        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-fade-up">
            <Badge className={darkMode ? "border-teal-900 bg-teal-950/60 text-teal-300" : ""}>
              {txt.badge}
            </Badge>
            <h1 className="max-w-xl text-4xl font-bold leading-tight md:text-5xl">{txt.heading}</h1>
            <p className={`mt-5 max-w-xl text-lg ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
              {txt.blurb}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                href="/analyze-url"
                className={`rounded-xl px-5 py-3 text-sm font-semibold text-white transition ${
                  darkMode ? "bg-teal-600 hover:bg-teal-500" : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                {txt.ctaPrimary}
              </Button>
              <Button
                href="/estimate"
                variant="secondary"
                className={`${
                  darkMode
                    ? "border-slate-600 bg-slate-900 text-slate-200 hover:border-slate-500"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {txt.ctaSecondary}
              </Button>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {highlights.map((item) => (
                <Card
                  key={item.label}
                  className={`rounded-xl p-4 transition-transform duration-300 hover:-translate-y-1 ${
                    darkMode
                      ? "border-slate-700 bg-slate-900"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="text-xl font-bold">{item.value}</p>
                  <p className={`mt-1 text-xs uppercase tracking-wide ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {item.label}
                  </p>
                </Card>
              ))}
            </div>
            {!statsReady ? (
              <p className={`mt-3 text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                {txt.statsLoading}
              </p>
            ) : null}
          </div>

          <aside
            className={`animate-fade-up-delay rounded-3xl border p-6 shadow-md ${
              darkMode
                ? "border-slate-700 bg-gradient-to-b from-slate-900 to-slate-950"
                : "border-slate-200 bg-white"
            }`}
          >
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              {txt.cardsLabel}
            </p>
            <div className="mt-4 space-y-3">
              {cards.map((card) => (
                <div
                  key={`${card.zone}-${card.type}-${card.value}`}
                  className={`rounded-xl border p-4 ${
                    darkMode
                      ? "border-slate-700 bg-slate-900/70"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{card.zone}</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                      {card.score}
                    </span>
                  </div>
                  <p className={`mt-2 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {card.type}
                  </p>
                  <p className="mt-1 text-lg font-semibold">{card.value}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-5 px-6 pb-12 md:grid-cols-3">
        {txt.features.map((feature) => (
          <Card
            key={feature.title}
            className={`animate-fade-up-delay-2 ${
              darkMode
                ? "border-slate-700 bg-slate-900"
                : "border-slate-200 bg-white"
            }`}
          >
            <h2 className="text-lg font-semibold">{feature.title}</h2>
            <p className={`mt-3 text-sm leading-6 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
              {feature.description}
            </p>
          </Card>
        ))}
      </section>
      <PageFooter />
    </main>
  );
}
