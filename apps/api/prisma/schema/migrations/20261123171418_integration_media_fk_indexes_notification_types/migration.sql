-- integration: dedicated listing notification types + indexes on every media foreign key
-- (media reference counts, attach/detach checks and FK checks on media delete).

-- AlterEnum (PostgreSQL 12+ allows several ADD VALUE in one transaction)
ALTER TYPE "notification_type" ADD VALUE 'LISTING_EXPIRED';
ALTER TYPE "notification_type" ADD VALUE 'CO_BROKER_REQUESTED';

-- CreateIndex
CREATE INDEX "agencies_logo_media_id_idx" ON "agencies"("logo_media_id");

-- CreateIndex
CREATE INDEX "agency_documents_media_id_idx" ON "agency_documents"("media_id");

-- CreateIndex
CREATE INDEX "banners_pc_media_id_idx" ON "banners"("pc_media_id");

-- CreateIndex
CREATE INDEX "banners_mobile_media_id_idx" ON "banners"("mobile_media_id");

-- CreateIndex
CREATE INDEX "complex_photos_media_id_idx" ON "complex_photos"("media_id");

-- CreateIndex
CREATE INDEX "deal_request_photos_media_id_idx" ON "deal_request_photos"("media_id");

-- CreateIndex
CREATE INDEX "listing_photos_media_id_idx" ON "listing_photos"("media_id");

-- CreateIndex
CREATE INDEX "popups_media_id_idx" ON "popups"("media_id");
