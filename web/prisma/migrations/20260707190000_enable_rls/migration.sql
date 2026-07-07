-- Enable Row Level Security (RLS) on public tables exposed to PostgREST.
--
-- Context:
--   The Supabase Security Advisor reports "RLS Disabled in Public" for these tables.
--   This application accesses the database exclusively through Prisma using the
--   Postgres owner role (DATABASE_URL / DIRECT_URL). The table owner bypasses RLS,
--   so enabling RLS does NOT affect the app, the scraper, or the migration scripts.
--
--   No component uses the Supabase anon/service_role keys or the auto-generated
--   PostgREST/Data API. Therefore we enable RLS with NO policies, which denies all
--   access through the public API (anon + authenticated) and resolves the advisor
--   errors safely.
--
--   _prisma_migrations is an internal Prisma bookkeeping table and must never be
--   reachable via the public API; RLS with no policies fully locks it down while
--   Prisma (running as the owner role) continues to read/write it normally.

ALTER TABLE "public"."listings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."subscribers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
