-- core: notification_types_inquiries_sites
-- In-app notifications of inquiries (INQUIRY_RECEIVED → office members, INQUIRY_REPLIED → the
-- member who asked) and of 사무소 홈페이지 decisions (AGENCY_SITE_APPROVED / _REJECTED → owner),
-- docs/agency-sites/SPEC.md §1.1. Written in the same release that adds them: deliberate
-- exception to the two-release enum rule (CONVENTIONS §11), pre-launch (SPEC.md "Rollback note").

-- AlterEnum (PostgreSQL 12+ allows several ADD VALUE in one transaction)
ALTER TYPE "notification_type" ADD VALUE 'INQUIRY_RECEIVED';
ALTER TYPE "notification_type" ADD VALUE 'INQUIRY_REPLIED';
ALTER TYPE "notification_type" ADD VALUE 'AGENCY_SITE_APPROVED';
ALTER TYPE "notification_type" ADD VALUE 'AGENCY_SITE_REJECTED';
