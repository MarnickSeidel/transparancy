-- CreateEnum
CREATE TYPE "EmailContactStatus" AS ENUM ('pending', 'active', 'unsubscribed');

-- CreateEnum
CREATE TYPE "EmailList" AS ENUM (
  'deals_city',
  'deals_neighborhood',
  'price_drops_city',
  'market_monthly_city',
  'market_quarterly_colombia'
);

-- CreateTable
CREATE TABLE "email_contacts" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "status" "EmailContactStatus" NOT NULL DEFAULT 'pending',
    "source" TEXT,
    "confirm_token" TEXT NOT NULL,
    "unsubscribe_token" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_preferences" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "list" "EmailList" NOT NULL,
    "city" TEXT,
    "neighborhood" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_send_logs" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "preference_id" UUID,
    "digest_key" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_send_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_contacts_email_key" ON "email_contacts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "email_contacts_confirm_token_key" ON "email_contacts"("confirm_token");

-- CreateIndex
CREATE UNIQUE INDEX "email_contacts_unsubscribe_token_key" ON "email_contacts"("unsubscribe_token");

-- CreateIndex
CREATE INDEX "email_contacts_status_idx" ON "email_contacts"("status");

-- CreateIndex
CREATE INDEX "email_contacts_created_at_idx" ON "email_contacts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_preferences_contact_id_list_city_neighborhood_key" ON "email_preferences"("contact_id", "list", "city", "neighborhood");

-- CreateIndex
CREATE INDEX "email_preferences_list_active_city_idx" ON "email_preferences"("list", "active", "city");

-- CreateIndex
CREATE UNIQUE INDEX "email_send_logs_contact_id_digest_key_key" ON "email_send_logs"("contact_id", "digest_key");

-- CreateIndex
CREATE INDEX "email_send_logs_digest_key_idx" ON "email_send_logs"("digest_key");

-- AddForeignKey
ALTER TABLE "email_preferences" ADD CONSTRAINT "email_preferences_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "email_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_send_logs" ADD CONSTRAINT "email_send_logs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "email_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_send_logs" ADD CONSTRAINT "email_send_logs_preference_id_fkey" FOREIGN KEY ("preference_id") REFERENCES "email_preferences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
