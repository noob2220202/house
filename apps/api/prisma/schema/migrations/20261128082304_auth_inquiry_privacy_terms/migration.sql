-- auth: inquiry_privacy_terms
-- Purpose consent of 문의 남기기 (POST /inquiries, docs/agency-sites/SPEC.md §1.1). Written in the
-- same release that adds it: deliberate exception to the two-release enum rule (CONVENTIONS §11)
-- while the service is pre-launch with test data only (SPEC.md "Rollback note").

-- AlterEnum
ALTER TYPE "terms_type" ADD VALUE 'INQUIRY_PRIVACY';
