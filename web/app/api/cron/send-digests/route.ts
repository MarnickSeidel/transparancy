import { NextResponse } from "next/server"

import { runEmailDigests } from "@/lib/email/sendDigests"
import { isEmailList } from "@/lib/email/validate"

export const dynamic = "force-dynamic"

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[cron] CRON_SECRET is not configured — denying request")
    }
    return process.env.NODE_ENV === "development"
  }
  const header = req.headers.get("authorization")?.trim()
  if (header === `Bearer ${secret}`) return true
  const urlSecret = new URL(req.url).searchParams.get("secret")?.trim()
  return urlSecret === secret
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let city: string | null = null
  let list: import("@prisma/client").EmailList | null = null
  let force = false

  try {
    const body = (await req.json()) as {
      city?: string
      list?: string
      force?: boolean
    }
    city = body.city?.trim() || null
    list = body.list && isEmailList(body.list) ? body.list : null
    force = Boolean(body.force)
  } catch {
    // empty body is fine
  }

  const result = await runEmailDigests({ city, list, force })
  return NextResponse.json(result)
}

export async function GET(req: Request) {
  return POST(req)
}
