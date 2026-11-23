-- agencies: a 등록번호 is reserved only by a live office (APPROVED / SUSPENDED, not deleted).
-- The global unique indexes let any applicant park a real office's public number on a PENDING or
-- REJECTED application and lock that office out (audit SEC-03). Pending duplicates are now allowed;
-- approving one rejects the others (AgencyReviewService.decide).

-- DropIndex
DROP INDEX IF EXISTS "agencies_registration_number_key";

-- DropIndex
DROP INDEX IF EXISTS "agencies_registration_key_key";

-- CreateIndex: lookups of duplicates in any status (registration, review queue).
CREATE INDEX "agencies_registration_key_idx" ON "agencies"("registration_key");

-- CreateIndex: partial, so not declared in the Prisma schema (see agencies.prisma registrationKey).
CREATE UNIQUE INDEX "agencies_registration_key_live" ON "agencies"("registration_key")
  WHERE "deleted_at" IS NULL AND "status" IN ('APPROVED', 'SUSPENDED');
