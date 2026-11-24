-- AlterTable
ALTER TABLE "deal_requests" ADD COLUMN     "spam_flagged_at" TIMESTAMPTZ(3),
ADD COLUMN     "spam_flagged_by" UUID,
ADD COLUMN     "spam_reason" VARCHAR(500);
