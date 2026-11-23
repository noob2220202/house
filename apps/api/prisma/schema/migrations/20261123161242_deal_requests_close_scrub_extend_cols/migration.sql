-- deal-requests: close_scrub_extend_cols
-- AlterTable
ALTER TABLE "deal_requests" ADD COLUMN     "close_reason" VARCHAR(500),
ADD COLUMN     "contact_scrubbed_at" TIMESTAMPTZ(3),
ADD COLUMN     "extension_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "suggested_deposit" INTEGER,
ADD COLUMN     "suggested_monthly_rent" INTEGER,
ADD COLUMN     "suggested_price" INTEGER;

-- CreateIndex
CREATE INDEX "deal_requests_closed_at_idx" ON "deal_requests"("closed_at");
