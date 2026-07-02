import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  email?: unknown;
  source?: unknown;
  city?: unknown;
};

function normalizeEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const email = v.trim().toLowerCase();
  if (!email) return null;
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return ok ? email : null;
}

function normalizeOptional(v: unknown, max = 80): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const email = normalizeEmail(body.email);
    if (!email) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }

    const source = normalizeOptional(body.source, 40);
    const city = normalizeOptional(body.city, 80);

    await prisma.subscriber.upsert({
      where: { email },
      create: { email, source: source ?? undefined, city: city ?? undefined },
      update: { source: source ?? undefined, city: city ?? undefined },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
