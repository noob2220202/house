-- agencies: search/review-queue indexes that were declared in the schema but missing from init,
-- and a generated uniqueness key for 등록번호 so "46150-2020-00012" and "4615020200012" (or other
-- spellings differing only in punctuation/case) cannot register the same office twice.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agencies_representative_name_trgm_idx" ON "agencies" USING GIN ("representative_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agencies_status_created_at_idx" ON "agencies"("status", "created_at");

-- Canonicalize stored numbers of the modern 시군구-연도-일련번호 format written without hyphens.
UPDATE "agencies"
SET "registration_number" = regexp_replace("registration_number", '^(\d{5})(\d{4})(\d{5})$', '\1-\2-\3')
WHERE "registration_number" ~ '^\d{14}$';

-- AlterTable: mirrors registrationNumberKey() in packages/shared/src/agencies/rules.ts.
ALTER TABLE "agencies" ADD COLUMN "registration_key" VARCHAR(40)
  GENERATED ALWAYS AS (upper(regexp_replace("registration_number", '[^0-9A-Za-z가-힣]', '', 'g'))) STORED;

-- CreateIndex
CREATE UNIQUE INDEX "agencies_registration_key_key" ON "agencies"("registration_key");
