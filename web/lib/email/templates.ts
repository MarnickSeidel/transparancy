import type { EmailList } from "@prisma/client"

import { absoluteUrl } from "@/lib/siteUrl"

type Locale = "es" | "en"

function listLabel(list: EmailList, locale: Locale): string {
  const es: Record<EmailList, string> = {
    deals_city: "Oportunidades en tu ciudad",
    deals_neighborhood: "Oportunidades en tu barrio",
    price_drops_city: "Bajas de precio en tu ciudad",
    market_monthly_city: "Resumen mensual del mercado (ciudad)",
    market_quarterly_colombia: "Panorama trimestral de Colombia",
  }
  const en: Record<EmailList, string> = {
    deals_city: "Deal alerts in your city",
    deals_neighborhood: "Deal alerts in your neighborhood",
    price_drops_city: "Price drops in your city",
    market_monthly_city: "Monthly city market report",
    market_quarterly_colombia: "Quarterly Colombia market overview",
  }
  return locale === "en" ? en[list] : es[list]
}

function layout(args: {
  locale: Locale
  title: string
  bodyHtml: string
  unsubscribeUrl: string
}) {
  let token = ""
  try {
    token = new URL(args.unsubscribeUrl).searchParams.get("token") ?? ""
  } catch {
    token = ""
  }
  const manageUrl = token
    ? absoluteUrl(`/email/preferences?token=${encodeURIComponent(token)}`)
    : absoluteUrl("/email/preferences")
  const footer =
    args.locale === "en"
      ? `You received this from Habidata. <a href="${manageUrl}">Manage preferences</a> · <a href="${args.unsubscribeUrl}">Unsubscribe</a> · <a href="${absoluteUrl("/privacy")}">Privacy</a>`
      : `Recibiste este correo de Habidata. <a href="${manageUrl}">Administrar preferencias</a> · <a href="${args.unsubscribeUrl}">Cancelar suscripción</a> · <a href="${absoluteUrl("/privacy")}">Privacidad</a>`

  return `<!DOCTYPE html>
<html lang="${args.locale}">
<head><meta charset="utf-8"><title>${args.title}</title></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;max-width:560px;margin:0 auto;padding:24px">
  <p style="font-weight:600;font-size:18px;margin:0 0 16px">Habidata</p>
  ${args.bodyHtml}
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
  <p style="font-size:12px;color:#64748b">${footer}</p>
</body>
</html>`
}

export function buildConfirmEmail(args: {
  locale: Locale
  confirmUrl: string
  unsubscribeUrl: string
  preferences: Array<{ list: EmailList; city?: string | null; neighborhood?: string | null }>
}) {
  const items = args.preferences
    .map((p) => {
      const label = listLabel(p.list, args.locale)
      const scope =
        p.neighborhood && p.city
          ? ` — ${p.neighborhood}, ${p.city}`
          : p.city
            ? ` — ${p.city}`
            : ""
      return `<li>${label}${scope}</li>`
    })
    .join("")

  const isEn = args.locale === "en"
  const subject = isEn
    ? "Confirm your Habidata email preferences"
    : "Confirma tus preferencias de email en Habidata"
  const bodyHtml = isEn
    ? `<h1 style="font-size:20px;margin:0 0 12px">Confirm your subscription</h1>
       <p>You asked to receive:</p>
       <ul>${items}</ul>
       <p><a href="${args.confirmUrl}" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Confirm email</a></p>
       <p style="font-size:13px;color:#64748b">If you did not request this, ignore this message.</p>`
    : `<h1 style="font-size:20px;margin:0 0 12px">Confirma tu suscripción</h1>
       <p>Seleccionaste recibir:</p>
       <ul>${items}</ul>
       <p><a href="${args.confirmUrl}" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Confirmar correo</a></p>
       <p style="font-size:13px;color:#64748b">Si no solicitaste esto, ignora este mensaje.</p>`

  const html = layout({
    locale: args.locale,
    title: subject,
    bodyHtml,
    unsubscribeUrl: args.unsubscribeUrl,
  })

  const text = isEn
    ? `Confirm your Habidata subscription: ${args.confirmUrl}`
    : `Confirma tu suscripción en Habidata: ${args.confirmUrl}`

  return { subject, html, text }
}

export function buildDealDigestEmail(args: {
  locale: Locale
  city: string
  neighborhood?: string | null
  listings: Array<{
    title: string
    url: string
    priceCop: string
    pricePerM2: number | null
    discountPct: number | null
    neighborhood: string | null
  }>
  unsubscribeUrl: string
  dataDate: string
}) {
  const isEn = args.locale === "en"
  const scope = args.neighborhood ? `${args.neighborhood}, ${args.city}` : args.city
  const subject = isEn
    ? `Top deals in ${scope} — Habidata`
    : `Mejores oportunidades en ${scope} — Habidata`

  const rows =
    args.listings.length === 0
      ? `<p>${isEn ? "No new standout deals this period." : "No hay oportunidades destacadas en este período."}</p>`
      : `<ul style="padding-left:18px">${args.listings
          .map((l) => {
            const discount =
              l.discountPct != null
                ? ` · ${l.discountPct.toFixed(1)}% ${isEn ? "vs ref." : "vs ref."}`
                : ""
            const ppm2 =
              l.pricePerM2 != null
                ? ` · $${Math.round(l.pricePerM2).toLocaleString(isEn ? "en-US" : "es-CO")}/m²`
                : ""
            const nh = l.neighborhood ? ` (${l.neighborhood})` : ""
            return `<li style="margin-bottom:12px"><a href="${l.url}">${l.title}</a>${nh}<br/><span style="color:#334155">${l.priceCop}${ppm2}${discount}</span></li>`
          })
          .join("")}</ul>`

  const bodyHtml = isEn
    ? `<h1 style="font-size:20px">Deal digest — ${scope}</h1>
       <p style="font-size:13px;color:#64748b">Data refreshed ${args.dataDate}. Source: Finca Raíz listings.</p>
       ${rows}
       <p><a href="${absoluteUrl("/opportunities")}">Browse all opportunities →</a></p>`
    : `<h1 style="font-size:20px">Resumen de oportunidades — ${scope}</h1>
       <p style="font-size:13px;color:#64748b">Datos actualizados ${args.dataDate}. Fuente: publicaciones Finca Raíz.</p>
       ${rows}
       <p><a href="${absoluteUrl("/opportunities")}">Ver todas las oportunidades →</a></p>`

  return {
    subject,
    html: layout({ locale: args.locale, title: subject, bodyHtml, unsubscribeUrl: args.unsubscribeUrl }),
    text: subject,
  }
}

export function buildPriceDropDigestEmail(args: {
  locale: Locale
  city: string
  drops: Array<{
    title: string
    url: string
    priceCop: string
    previousPriceCop: string
    dropPct: number
    neighborhood: string | null
  }>
  unsubscribeUrl: string
  dataDate: string
}) {
  const isEn = args.locale === "en"
  const subject = isEn
    ? `Recent price drops in ${args.city} — Habidata`
    : `Bajas de precio recientes en ${args.city} — Habidata`

  const rows =
    args.drops.length === 0
      ? `<p>${isEn ? "No notable price drops this period." : "Sin bajas de precio destacadas en este período."}</p>`
      : `<ul style="padding-left:18px">${args.drops
          .map((d) => {
            const nh = d.neighborhood ? ` (${d.neighborhood})` : ""
            return `<li style="margin-bottom:12px"><a href="${d.url}">${d.title}</a>${nh}<br/>
              <span style="color:#334155">${d.previousPriceCop} → ${d.priceCop} (−${d.dropPct.toFixed(1)}%)</span></li>`
          })
          .join("")}</ul>`

  const bodyHtml = isEn
    ? `<h1 style="font-size:20px">Price drops — ${args.city}</h1>
       <p style="font-size:13px;color:#64748b">As of ${args.dataDate}</p>${rows}
       <p><a href="${absoluteUrl("/price-drops")}">View all price drops →</a></p>`
    : `<h1 style="font-size:20px">Bajas de precio — ${args.city}</h1>
       <p style="font-size:13px;color:#64748b">Al ${args.dataDate}</p>${rows}
       <p><a href="${absoluteUrl("/price-drops")}">Ver todas las bajas →</a></p>`

  return {
    subject,
    html: layout({ locale: args.locale, title: subject, bodyHtml, unsubscribeUrl: args.unsubscribeUrl }),
    text: subject,
  }
}

export function buildMarketDigestEmail(args: {
  locale: Locale
  city: string
  monthLabel: string
  medianPpm2: number | null
  momChangePct: number | null
  sample: number
  activeListings: number
  dealCount: number
  priceDropCount: number
  unsubscribeUrl: string
}) {
  const isEn = args.locale === "en"
  const subject = isEn
    ? `${args.city} market — ${args.monthLabel}`
    : `Mercado ${args.city} — ${args.monthLabel}`

  const median =
    args.medianPpm2 != null
      ? `$${Math.round(args.medianPpm2).toLocaleString(isEn ? "en-US" : "es-CO")}/m²`
      : "—"
  const change =
    args.momChangePct != null
      ? `${args.momChangePct >= 0 ? "+" : ""}${args.momChangePct.toFixed(1)}% ${isEn ? "vs prior month" : "vs mes anterior"}`
      : isEn
        ? "Not enough history"
        : "Historial insuficiente"

  const bodyHtml = isEn
    ? `<h1 style="font-size:20px">${args.city} — ${args.monthLabel}</h1>
       <p><strong>Median price/m²:</strong> ${median}<br/><strong>Change:</strong> ${change}</p>
       <ul>
         <li>Sample (median): ${args.sample} listings</li>
         <li>Active listings: ${args.activeListings}</li>
         <li>Deals flagged: ${args.dealCount}</li>
         <li>Recent price drops: ${args.priceDropCount}</li>
       </ul>
       <p><a href="${absoluteUrl("/dashboard")}">Open dashboard →</a> · <a href="${absoluteUrl("/zones")}">Zone dossiers →</a></p>
       <p style="font-size:12px;color:#64748b">Based on Finca Raíz data. Not investment advice.</p>`
    : `<h1 style="font-size:20px">${args.city} — ${args.monthLabel}</h1>
       <p><strong>Mediana precio/m²:</strong> ${median}<br/><strong>Variación:</strong> ${change}</p>
       <ul>
         <li>Muestra (mediana): ${args.sample} anuncios</li>
         <li>Anuncios activos: ${args.activeListings}</li>
         <li>Oportunidades detectadas: ${args.dealCount}</li>
         <li>Bajas de precio recientes: ${args.priceDropCount}</li>
       </ul>
       <p><a href="${absoluteUrl("/dashboard")}">Ver tablero →</a> · <a href="${absoluteUrl("/zones")}">Dossiers por barrio →</a></p>
       <p style="font-size:12px;color:#64748b">Basado en datos Finca Raíz. No es asesoría de inversión.</p>`

  return {
    subject,
    html: layout({ locale: args.locale, title: subject, bodyHtml, unsubscribeUrl: args.unsubscribeUrl }),
    text: subject,
  }
}

export function buildColombiaDigestEmail(args: {
  locale: Locale
  quarterLabel: string
  cities: Array<{
    city: string
    medianPpm2: number | null
    momChangePct: number | null
    sample: number
  }>
  unsubscribeUrl: string
}) {
  const isEn = args.locale === "en"
  const subject = isEn
    ? `Colombia real estate overview — ${args.quarterLabel}`
    : `Panorama inmobiliario Colombia — ${args.quarterLabel}`

  const rows = args.cities
    .map((c) => {
      const med =
        c.medianPpm2 != null
          ? `$${Math.round(c.medianPpm2).toLocaleString(isEn ? "en-US" : "es-CO")}/m²`
          : "—"
      const ch =
        c.momChangePct != null ? `${c.momChangePct >= 0 ? "+" : ""}${c.momChangePct.toFixed(1)}%` : "—"
      return `<li><strong>${c.city}</strong>: ${med} (${ch}, n=${c.sample})</li>`
    })
    .join("")

  const bodyHtml = isEn
    ? `<h1 style="font-size:20px">Colombia — ${args.quarterLabel}</h1>
       <p>Median price/m² and month-over-month change by city:</p>
       <ul>${rows}</ul>
       <p><a href="${absoluteUrl("/dashboard")}">Explore the dashboard →</a></p>`
    : `<h1 style="font-size:20px">Colombia — ${args.quarterLabel}</h1>
       <p>Mediana precio/m² y variación mensual por ciudad:</p>
       <ul>${rows}</ul>
       <p><a href="${absoluteUrl("/dashboard")}">Explorar el tablero →</a></p>`

  return {
    subject,
    html: layout({ locale: args.locale, title: subject, bodyHtml, unsubscribeUrl: args.unsubscribeUrl }),
    text: subject,
  }
}

export function unsubscribeUrl(token: string, list?: EmailList) {
  const p = new URLSearchParams({ token })
  if (list) p.set("list", list)
  return absoluteUrl(`/api/email/unsubscribe?${p.toString()}`)
}
