-- listings: cobroker_consent_version_expiry
-- 공동중개 consent (PENDING) and primary-agency removal (REMOVED), optimistic concurrency
-- counter on listings, and an index for the ad-expiry job.
ALTER TYPE "listing_agency_status" ADD VALUE 'PENDING';
ALTER TYPE "listing_agency_status" ADD VALUE 'REMOVED';

-- AlterTable
ALTER TABLE "listings" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "listings_status_expires_at_idx" ON "listings"("status", "expires_at");

-- Backfill: ads published before expiry existed get one ad period from their latest
-- publication/확인 date (GREATEST ignores NULLs), so the expiry job can take them down later.
UPDATE "listings"
SET "expires_at" = COALESCE(GREATEST("published_at", "verified_at"), now()) + interval '30 days'
WHERE "status" IN ('ACTIVE', 'RESERVED') AND "expires_at" IS NULL AND "deleted_at" IS NULL;
