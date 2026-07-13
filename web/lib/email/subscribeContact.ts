import type { EmailContact, EmailPreference } from "@prisma/client"

import { sendEmail } from "@/lib/email/sendEmail"
import { buildConfirmEmail, unsubscribeUrl } from "@/lib/email/templates"
import { newToken } from "@/lib/email/tokens"
import type { SubscribeInput } from "@/lib/email/types"
import { prisma } from "@/lib/prisma"
import { absoluteUrl } from "@/lib/siteUrl"

export type SubscribeResult =
  | { ok: true; needsConfirmation: boolean; devConfirmUrl?: string }
  | { ok: false; error: "invalid_email" | "invalid_preferences" | "send_failed" }

async function upsertLegacySubscriber(email: string, source?: string, city?: string | null) {
  const firstCity = city ?? undefined
  await prisma.subscriber.upsert({
    where: { email },
    create: { email, source: source ?? undefined, city: firstCity },
    update: { source: source ?? undefined, city: firstCity ?? undefined },
  })
}

export async function subscribeContact(input: SubscribeInput): Promise<SubscribeResult> {
  const preferences = input.preferences
  if (preferences.length === 0) {
    return { ok: false, error: "invalid_preferences" }
  }

  const locale = input.locale === "en" ? "en" : "es"
  const source = input.source?.trim() || undefined
  const primaryCity = preferences.find((p) => p.city)?.city ?? null

  let contact = await prisma.emailContact.findUnique({
    where: { email: input.email },
    include: { preferences: true },
  })

  if (!contact) {
    contact = await prisma.emailContact.create({
      data: {
        email: input.email,
        locale,
        source,
        confirmToken: newToken(),
        unsubscribeToken: newToken(),
        preferences: {
          create: preferences.map((p) => ({
            list: p.list,
            city: p.city ?? null,
            neighborhood: p.neighborhood ?? null,
            active: true,
          })),
        },
      },
      include: { preferences: true },
    })
  } else {
    const wasUnsubscribed = contact.status === "unsubscribed"
    const needsReconfirm = wasUnsubscribed || contact.status === "pending"
    const confirmToken = needsReconfirm ? newToken() : contact.confirmToken

    await prisma.$transaction(async (tx) => {
      await tx.emailContact.update({
        where: { id: contact!.id },
        data: {
          locale,
          source: source ?? contact!.source,
          status: needsReconfirm ? "pending" : contact!.status,
          confirmToken,
          confirmedAt: needsReconfirm ? null : contact!.confirmedAt,
        },
      })

      for (const pref of preferences) {
        const existing = contact!.preferences.find(
          (e) =>
            e.list === pref.list &&
            (e.city ?? null) === (pref.city ?? null) &&
            (e.neighborhood ?? null) === (pref.neighborhood ?? null),
        )
        if (existing) {
          await tx.emailPreference.update({
            where: { id: existing.id },
            data: { active: true },
          })
        } else {
          await tx.emailPreference.create({
            data: {
              contactId: contact!.id,
              list: pref.list,
              city: pref.city ?? null,
              neighborhood: pref.neighborhood ?? null,
              active: true,
            },
          })
        }
      }
    })

    contact = await prisma.emailContact.findUniqueOrThrow({
      where: { id: contact.id },
      include: { preferences: true },
    })
  }

  await upsertLegacySubscriber(input.email, source, primaryCity)

  if (contact.status === "active") {
    return { ok: true, needsConfirmation: false }
  }

  const activePrefs = contact.preferences.filter((p) => p.active)
  const confirmUrl = absoluteUrl(`/api/email/confirm?token=${contact.confirmToken}`)
  const mail = buildConfirmEmail({
    locale,
    confirmUrl,
    unsubscribeUrl: unsubscribeUrl(contact.unsubscribeToken),
    preferences: activePrefs.map((p) => ({
      list: p.list,
      city: p.city,
      neighborhood: p.neighborhood,
    })),
  })

  const sent = await sendEmail({
    to: contact.email,
    subject: mail.subject,
    html: mail.html,
    text: `${mail.text}\n\n${confirmUrl}`,
  })

  if (!sent.ok) {
    return { ok: false, error: "send_failed" }
  }

  return {
    ok: true,
    needsConfirmation: true,
    devConfirmUrl: sent.devMode ? confirmUrl : undefined,
  }
}

export async function confirmContact(token: string): Promise<EmailContact | null> {
  const contact = await prisma.emailContact.findUnique({ where: { confirmToken: token } })
  if (!contact) return null
  if (contact.status === "unsubscribed") return null

  return prisma.emailContact.update({
    where: { id: contact.id },
    data: {
      status: "active",
      confirmedAt: new Date(),
    },
  })
}

export async function unsubscribeContact(
  token: string,
  list?: string | null,
): Promise<{ contact: EmailContact; preferences: EmailPreference[] } | null> {
  const contact = await prisma.emailContact.findUnique({
    where: { unsubscribeToken: token },
    include: { preferences: true },
  })
  if (!contact) return null

  if (list) {
    await prisma.emailPreference.updateMany({
      where: { contactId: contact.id, list: list as EmailPreference["list"], active: true },
      data: { active: false },
    })
    const remaining = await prisma.emailPreference.count({
      where: { contactId: contact.id, active: true },
    })
    if (remaining === 0) {
      await prisma.emailContact.update({
        where: { id: contact.id },
        data: { status: "unsubscribed" },
      })
    }
  } else {
    await prisma.emailPreference.updateMany({
      where: { contactId: contact.id },
      data: { active: false },
    })
    await prisma.emailContact.update({
      where: { id: contact.id },
      data: { status: "unsubscribed" },
    })
  }

  const updated = await prisma.emailContact.findUnique({
    where: { id: contact.id },
    include: { preferences: true },
  })
  if (!updated) return null
  return { contact: updated, preferences: updated.preferences }
}
