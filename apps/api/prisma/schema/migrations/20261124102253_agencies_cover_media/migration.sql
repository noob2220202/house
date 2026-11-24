-- agencies: cover (header) image of the public page, PUBLIC media of purpose AGENCY_COVER.

-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "cover_media_id" UUID;

-- CreateIndex
CREATE INDEX "agencies_cover_media_id_idx" ON "agencies"("cover_media_id");

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reference guard (see 20261123161645_media_cleanup_index_reference_guard): the cover may only
-- start pointing at a live media row. Replaces the logo-only trigger with one covering both.
DROP TRIGGER IF EXISTS agencies_logo_media_live ON agencies;
CREATE TRIGGER agencies_media_live
  BEFORE INSERT OR UPDATE OF logo_media_id, cover_media_id ON agencies
  FOR EACH ROW EXECUTE FUNCTION media_assert_live_reference('logo_media_id', 'cover_media_id');
