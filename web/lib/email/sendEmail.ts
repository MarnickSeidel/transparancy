type SendEmailArgs = {
  to: string
  subject: string
  html: string
  text?: string
}

export type SendEmailResult =
  | { ok: true; id: string | null; devMode: boolean }
  | { ok: false; error: string }

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim() || "CasasClaras <onboarding@resend.dev>"

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.info("[email:dev] Would send:", {
        to: args.to,
        subject: args.subject,
        textPreview: args.text?.slice(0, 200) ?? args.html.slice(0, 200),
      })
      return { ok: true, id: null, devMode: true }
    }
    console.error("[email] RESEND_API_KEY is not configured")
    return { ok: false, error: "email_not_configured" }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error("[email] Resend error:", res.status, body)
      return { ok: false, error: "send_failed" }
    }

    const json = (await res.json()) as { id?: string }
    return { ok: true, id: json.id ?? null, devMode: false }
  } catch (e) {
    console.error("[email] send failed", e)
    return { ok: false, error: "send_failed" }
  }
}
