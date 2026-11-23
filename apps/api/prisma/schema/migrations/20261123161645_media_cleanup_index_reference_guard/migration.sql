-- media: cleanup index + reference guard

-- Cleanup scans: phase 2 (deleted_at IS NULL AND updated_at < cutoff ORDER BY updated_at)
-- and purge (deleted_at < cutoff ORDER BY deleted_at).
-- CreateIndex
CREATE INDEX "media_deleted_at_updated_at_idx" ON "media"("deleted_at", "updated_at");

-- Reference guard: a row may only start pointing at a LIVE (not soft-deleted) media row.
-- The FK alone only needs the row to exist, so an attach racing with DELETE /media/:id or the
-- orphan cleanup could link a soft-deleted upload whose files are already gone. The guard takes
-- FOR SHARE on the media row: a concurrent soft-delete (FOR UPDATE) either waits for the attach
-- to commit and then sees the reference (409 MEDIA_IN_USE / skipped by cleanup), or commits
-- first and the attach fails here with foreign_key_violation (re-evaluated under the lock).
-- Arguments: the referencing column names of the table.
CREATE OR REPLACE FUNCTION media_assert_live_reference() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  col text;
  new_id uuid;
  new_row jsonb := to_jsonb(NEW);
  old_row jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
BEGIN
  FOREACH col IN ARRAY TG_ARGV LOOP
    new_id := (new_row ->> col)::uuid;
    CONTINUE WHEN new_id IS NULL;
    CONTINUE WHEN old_row IS NOT NULL AND (old_row ->> col)::uuid IS NOT DISTINCT FROM new_id;
    PERFORM 1 FROM media WHERE id = new_id AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'media % is deleted or missing (%.%)', new_id, TG_TABLE_NAME, col
        USING ERRCODE = 'foreign_key_violation',
              CONSTRAINT = TG_TABLE_NAME || '_' || col || '_fkey';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER listing_photos_media_live
  BEFORE INSERT OR UPDATE OF media_id ON listing_photos
  FOR EACH ROW EXECUTE FUNCTION media_assert_live_reference('media_id');
CREATE TRIGGER complex_photos_media_live
  BEFORE INSERT OR UPDATE OF media_id ON complex_photos
  FOR EACH ROW EXECUTE FUNCTION media_assert_live_reference('media_id');
CREATE TRIGGER deal_request_photos_media_live
  BEFORE INSERT OR UPDATE OF media_id ON deal_request_photos
  FOR EACH ROW EXECUTE FUNCTION media_assert_live_reference('media_id');
CREATE TRIGGER agency_documents_media_live
  BEFORE INSERT OR UPDATE OF media_id ON agency_documents
  FOR EACH ROW EXECUTE FUNCTION media_assert_live_reference('media_id');
CREATE TRIGGER popups_media_live
  BEFORE INSERT OR UPDATE OF media_id ON popups
  FOR EACH ROW EXECUTE FUNCTION media_assert_live_reference('media_id');
CREATE TRIGGER agencies_logo_media_live
  BEFORE INSERT OR UPDATE OF logo_media_id ON agencies
  FOR EACH ROW EXECUTE FUNCTION media_assert_live_reference('logo_media_id');
CREATE TRIGGER banners_media_live
  BEFORE INSERT OR UPDATE OF pc_media_id, mobile_media_id ON banners
  FOR EACH ROW EXECUTE FUNCTION media_assert_live_reference('pc_media_id', 'mobile_media_id');
