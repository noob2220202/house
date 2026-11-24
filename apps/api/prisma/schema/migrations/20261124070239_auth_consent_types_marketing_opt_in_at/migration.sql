-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "terms_type" ADD VALUE 'PRIVACY_AGENCY_APPLICATION';
ALTER TYPE "terms_type" ADD VALUE 'PRIVACY_AGENCY_JOIN';
ALTER TYPE "terms_type" ADD VALUE 'DEAL_REQUEST_PRIVACY';
ALTER TYPE "terms_type" ADD VALUE 'DEAL_REQUEST_PROVIDE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "marketing_opt_in_at" TIMESTAMPTZ(3);

-- Backfill: members who are opted in now get the start of their current opt-in — the first
-- agreed MARKETING consent after their latest refusal (consents are append-only). Members with no
-- such record (opted in before consents were recorded) fall back to their signup time.
UPDATE "users" u
SET "marketing_opt_in_at" = COALESCE(
  (
    SELECT MIN(c."created_at")
    FROM "user_consents" c
    JOIN "terms_documents" d ON d."id" = c."terms_document_id"
    WHERE c."user_id" = u."id"
      AND d."type" = 'MARKETING'
      AND c."agreed"
      AND c."created_at" > COALESCE(
        (
          SELECT MAX(r."created_at")
          FROM "user_consents" r
          JOIN "terms_documents" rd ON rd."id" = r."terms_document_id"
          WHERE r."user_id" = u."id" AND rd."type" = 'MARKETING' AND NOT r."agreed"
        ),
        '-infinity'::timestamptz
      )
  ),
  u."created_at"
)
WHERE u."marketing_opt_in" AND u."marketing_opt_in_at" IS NULL;
