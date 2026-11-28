-- agencies: sites_subscriptions
-- 사무소 홈페이지 (agency_sites: one per office, requested by the owner, decided by an admin) and
-- office subscriptions (agency_subscriptions: paid periods recorded by an admin; enforcement is
-- off by default — FEATURES.siteSubscriptionRequired / platformSubscriptionRequired). SPEC §2.
-- New tables only; the hand-written part at the end adds what Prisma cannot express.

-- CreateEnum
CREATE TYPE "agency_site_status" AS ENUM ('REQUESTED', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "subscription_product" AS ENUM ('SITE', 'PLATFORM');

-- CreateTable
CREATE TABLE "agency_sites" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "status" "agency_site_status" NOT NULL DEFAULT 'REQUESTED',
    "slug" VARCHAR(30),
    "requested_slug" VARCHAR(30),
    "color" VARCHAR(20) NOT NULL DEFAULT 'BLUE',
    "tagline" VARCHAR(60),
    "requested_at" TIMESTAMPTZ(3) NOT NULL,
    "decided_at" TIMESTAMPTZ(3),
    "decided_by_admin_id" UUID,
    "decision_reason" VARCHAR(500),
    "https_ready_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agency_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_subscriptions" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "product" "subscription_product" NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "amount_won" INTEGER,
    "memo" VARCHAR(500),
    "canceled_at" TIMESTAMPTZ(3),
    "created_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agency_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agency_sites_agency_id_key" ON "agency_sites"("agency_id");

-- CreateIndex
CREATE INDEX "agency_sites_status_requested_at_idx" ON "agency_sites"("status", "requested_at");

-- CreateIndex
CREATE INDEX "agency_sites_requested_slug_idx" ON "agency_sites"("requested_slug");

-- CreateIndex
CREATE INDEX "agency_sites_decided_by_admin_id_idx" ON "agency_sites"("decided_by_admin_id");

-- CreateIndex
CREATE INDEX "agency_subscriptions_agency_id_product_idx" ON "agency_subscriptions"("agency_id", "product");

-- CreateIndex
CREATE INDEX "agency_subscriptions_created_by_admin_id_idx" ON "agency_subscriptions"("created_by_admin_id");

-- AddForeignKey
ALTER TABLE "agency_sites" ADD CONSTRAINT "agency_sites_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_sites" ADD CONSTRAINT "agency_sites_decided_by_admin_id_fkey" FOREIGN KEY ("decided_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_subscriptions" ADD CONSTRAINT "agency_subscriptions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_subscriptions" ADD CONSTRAINT "agency_subscriptions_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- hand-written (not in the Prisma schema; invisible to db:drift) ----------

-- CreateIndex: an approved slug belongs to one office while the site is ACTIVE or SUSPENDED
-- (rejected / never-approved rows keep slug NULL). Partial, so declared here only (see the
-- `slug` doc comment in agencies.prisma). Also serves the GET /sites/:slug lookup.
CREATE UNIQUE INDEX "agency_sites_slug_key" ON "agency_sites"("slug") WHERE "slug" IS NOT NULL;

-- CreateIndex: at most one open request per slug, so two owners cannot race for the same name
-- (the service also checks; a lost race surfaces as P2002 → AGENCY_SITE_SLUG_DUPLICATE).
CREATE UNIQUE INDEX "agency_sites_requested_slug_open_key" ON "agency_sites"("requested_slug")
  WHERE "status" = 'REQUESTED';

-- Slug format (@house/shared agencies/site.ts: 3–30 chars, one lower-case DNS label, no "--").
-- Defence in depth: approved slugs become nginx server names and certbot names (deploy/sites.sh,
-- run as root). Reserved words are an application rule (the list may change) and are not here.
ALTER TABLE "agency_sites" ADD CONSTRAINT "agency_sites_slug_format" CHECK (
  "slug" IS NULL OR (
    "slug" ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' AND length("slug") BETWEEN 3 AND 30
    AND position('--' in "slug") = 0
  )
);
ALTER TABLE "agency_sites" ADD CONSTRAINT "agency_sites_requested_slug_format" CHECK (
  "requested_slug" IS NULL OR (
    "requested_slug" ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' AND length("requested_slug") BETWEEN 3 AND 30
    AND position('--' in "requested_slug") = 0
  )
);

-- A period ends on or after its first day; amounts are never negative.
ALTER TABLE "agency_subscriptions" ADD CONSTRAINT "agency_subscriptions_period_check" CHECK (
  "ends_on" IS NULL OR "ends_on" >= "starts_on"
);
ALTER TABLE "agency_subscriptions" ADD CONSTRAINT "agency_subscriptions_amount_check" CHECK (
  "amount_won" IS NULL OR "amount_won" >= 0
);
