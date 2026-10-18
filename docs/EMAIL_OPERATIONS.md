# Email digests — operations runbook

Transactional email for CasasClaras uses **Resend**. Lists, preferences, and send logs live in Postgres (Prisma models `EmailContact`, `EmailPreference`, `EmailSendLog`).

**Code:** `web/lib/email/` · **Cron:** `POST|GET /api/cron/send-digests` · **Subscribe:** `POST /api/subscribe`

---

## Lists

| List | Scope | Notes |
|------|-------|-------|
| `deals_city` | City | Top deal alerts |
| `deals_neighborhood` | City + neighborhood | Requires neighborhood |
| `price_drops_city` | City | Recent asking-price drops |
| `market_monthly_city` | City | Monthly market summary |
| `market_quarterly_colombia` | National | City not required |

Defined in `web/lib/email/types.ts` (`EMAIL_LISTS`).

---

## Environment

| Variable | Required in prod | Purpose |
|----------|------------------|---------|
| `RESEND_API_KEY` | Yes (to send) | Resend API auth |
| `EMAIL_FROM` | Yes (to send) | From header, e.g. `CasasClaras <alertas@…>` |
| `CRON_SECRET` | Yes | Auth for digest cron |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Absolute links in templates |

Without `RESEND_API_KEY` in **development**, subscribe logs a preview and may return `devConfirmUrl`. In **production**, subscribe returns `email_not_configured`.

---

## Subscribe / confirm / unsubscribe

1. `POST /api/subscribe` — rate limit **5 / hour / IP**. Body includes email + preferences (legacy `lists` still accepted).
2. User receives a confirmation email (or console preview in dev).
3. Confirm via `/api/email/confirm?token=…` → contact status `active`.
4. Unsubscribe:
   - List-scoped: disables that preference only
   - Token without list: redirects to preferences UI (`/email/preferences`)

**Tokens:** confirm and unsubscribe tokens have **no expiry** in schema/routes. Preference access is authenticated by the unsubscribe token alone — treat links as secrets.

---

## Running digests

There is **no in-repo scheduler**. Wire an external cron (GitHub Actions, Railway, Vercel cron, etc.) to call the endpoint.

```bash
# Production-style (Bearer)
curl -X POST "$SITE/api/cron/send-digests" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'

# Query-param secret also accepted
curl "$SITE/api/cron/send-digests?secret=$CRON_SECRET"
```

Optional JSON body:

| Field | Effect |
|-------|--------|
| `city` | Only preferences for that city |
| `list` | Only that `EmailList` value |
| `force` | Deletes matching `EmailSendLog` rows, then resends |

**Auth rules:**

- If `CRON_SECRET` is set → require Bearer or `?secret=`
- If unset in **development** → allowed
- If unset in **production** → **denied** (401) + error log

---

## Deduplication

Each send is keyed roughly as:

```text
scrape:<YYYY-MM-DD>:<list>:<city|all>:<neighborhood|all>
```

Freshness date comes from global scrape freshness (`getGlobalDataFreshness`). A successful send writes `EmailSendLog`; later runs skip the same key unless `force: true`.

**Pitfall:** `force` can duplicate mail to real users. Use only for recovery after a failed/partial run, and prefer scoping with `city` / `list`.

---

## Processing model

- Preferences are processed **sequentially** with no batch size limit.
- Large subscriber counts can make a single cron invocation slow — monitor duration and consider city/list filters.
- Errors are counted per preference; one failure does not abort the whole run.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `unauthorized` from cron | Wrong/missing `CRON_SECRET`; prod with secret unset |
| `email_not_configured` on subscribe | Missing `RESEND_API_KEY` in production |
| Digests always `skipped` | Already sent for current scrape day; contact not `active`; preference inactive |
| Empty deal digests | No opportunities matching city filters / data stale — refresh derived data |
| Dev confirm works, prod does not | Resend domain/`EMAIL_FROM` not verified |

---

## Related code

| Path | Role |
|------|------|
| `lib/email/sendDigests.ts` | Digest selection + send loop |
| `lib/email/templates.ts` | HTML/text templates |
| `lib/email/sendEmail.ts` | Resend HTTP client |
| `app/api/subscribe/route.ts` | Signup |
| `app/api/email/confirm/route.ts` | Confirm |
| `app/api/email/unsubscribe/route.ts` | Unsubscribe |
| `app/api/cron/send-digests/route.ts` | Cron entry |
