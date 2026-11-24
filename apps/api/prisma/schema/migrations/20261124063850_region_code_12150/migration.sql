-- 2026-07-01: 전라남도 순천시 (46150) became 전남광주통합특별시 순천시 (12150, 시도 12).
-- Only the 시도·시군구 digits changed: 46150132 → 12150132, 4615031022 → 1215031022.
-- Rewrites every stored region code of the service region to the new code space
-- (docs/frontend-integration/DECISIONS.md D1). Data only, no schema change. Idempotent: every
-- statement touches legacy rows only, so a second run changes nothing.
--
-- Legacy code = '46' (시도) or '46150' followed by nothing, 3 or 5 digits (시군구/읍면동/리).
-- Other former 전라남도 시군구 got non-prefix codes (광양 46230 → 12190) and are left alone.
-- Not touched on purpose: 중개사무소 등록번호 (issued identifiers such as 46150-2020-00012),
-- free-text addresses, audit logs, and trade_records.source_key (opaque hashes; the sync re-keys
-- a contract stored under the legacy code when it sees it again, see complexes README).

-- 1. regions: insert the new rows (parents and children in one statement — the self-FK is
--    checked at the end of the statement), repoint every child, then drop the legacy rows.
--    An already existing new row wins over its legacy twin.
INSERT INTO "regions" (
  "code", "name", "full_name", "level", "parent_code", "lat", "lng", "is_active", "sort_order",
  "created_at", "updated_at"
)
SELECT
  CASE WHEN r."code" = '46' THEN '12' ELSE '12150' || substr(r."code", 6) END,
  CASE WHEN r."code" = '46' AND r."name" = '전라남도' THEN '전남광주통합특별시' ELSE r."name" END,
  regexp_replace(r."full_name", '^전라남도( |$)', '전남광주통합특별시\1'),
  r."level",
  CASE
    WHEN r."parent_code" = '46' THEN '12'
    WHEN r."parent_code" ~ '^46150([0-9]{3}([0-9]{2})?)?$' THEN '12150' || substr(r."parent_code", 6)
    ELSE r."parent_code"
  END,
  r."lat", r."lng", r."is_active", r."sort_order", r."created_at", CURRENT_TIMESTAMP
FROM "regions" r
WHERE r."code" ~ '^(46|46150([0-9]{3}([0-9]{2})?)?)$'
ON CONFLICT ("code") DO NOTHING;

UPDATE "regions"
SET "parent_code" = CASE
    WHEN "parent_code" = '46' THEN '12'
    ELSE '12150' || substr("parent_code", 6)
  END
WHERE "parent_code" ~ '^(46|46150([0-9]{3}([0-9]{2})?)?)$';

DELETE FROM "regions" r
WHERE r."code" ~ '^(46|46150([0-9]{3}([0-9]{2})?)?)$'
  AND NOT EXISTS (SELECT 1 FROM "regions" c WHERE c."parent_code" = r."code");

-- 2. 시군구 columns (VARCHAR(5)).
UPDATE "agencies" SET "sgg_code" = '12150' WHERE "sgg_code" = '46150';
UPDATE "complexes" SET "sgg_code" = '12150' WHERE "sgg_code" = '46150';
UPDATE "properties" SET "sgg_code" = '12150' WHERE "sgg_code" = '46150';
UPDATE "listings" SET "sgg_code" = '12150' WHERE "sgg_code" = '46150';
UPDATE "deal_requests" SET "sgg_code" = '12150' WHERE "sgg_code" = '46150';
UPDATE "trade_records" SET "sgg_code" = '12150' WHERE "sgg_code" = '46150';
UPDATE "trade_sync_runs" SET "sgg_code" = '12150' WHERE "sgg_code" = '46150';

-- 3. 법정동 columns (8/10 digits).
UPDATE "agencies" SET "emd_code" = '12150' || substr("emd_code", 6)
WHERE "emd_code" ~ '^46150[0-9]{3}([0-9]{2})?$';
UPDATE "complexes" SET "emd_code" = '12150' || substr("emd_code", 6)
WHERE "emd_code" ~ '^46150[0-9]{3}([0-9]{2})?$';
UPDATE "properties" SET "emd_code" = '12150' || substr("emd_code", 6)
WHERE "emd_code" ~ '^46150[0-9]{3}([0-9]{2})?$';
UPDATE "listings" SET "emd_code" = '12150' || substr("emd_code", 6)
WHERE "emd_code" ~ '^46150[0-9]{3}([0-9]{2})?$';
UPDATE "deal_requests" SET "emd_code" = '12150' || substr("emd_code", 6)
WHERE "emd_code" ~ '^46150[0-9]{3}([0-9]{2})?$';

-- 4. Any-level region codes (2/5/8/10 digits).
UPDATE "local_videos"
SET "region_code" = CASE
    WHEN "region_code" = '46' THEN '12'
    ELSE '12150' || substr("region_code", 6)
  END
WHERE "region_code" ~ '^(46|46150([0-9]{3}([0-9]{2})?)?)$';

-- banner_target_regions is keyed (banner_id, region_code): drop a legacy row whose new twin
-- already exists for the same banner, then rewrite the rest.
DELETE FROM "banner_target_regions" b
WHERE b."region_code" ~ '^(46|46150([0-9]{3}([0-9]{2})?)?)$'
  AND EXISTS (
    SELECT 1 FROM "banner_target_regions" n
    WHERE n."banner_id" = b."banner_id"
      AND n."region_code" = CASE
          WHEN b."region_code" = '46' THEN '12'
          ELSE '12150' || substr(b."region_code", 6)
        END
  );
UPDATE "banner_target_regions"
SET "region_code" = CASE
    WHEN "region_code" = '46' THEN '12'
    ELSE '12150' || substr("region_code", 6)
  END
WHERE "region_code" ~ '^(46|46150([0-9]{3}([0-9]{2})?)?)$';

-- deal_requests.region_codes (TEXT[]): map every element, keep the first occurrence's order.
UPDATE "deal_requests" d
SET "region_codes" = ARRAY(
  SELECT m."code"
  FROM (
    SELECT
      CASE
        WHEN u."code" = '46' THEN '12'
        WHEN u."code" ~ '^46150([0-9]{3}([0-9]{2})?)?$' THEN '12150' || substr(u."code", 6)
        ELSE u."code"
      END AS "code",
      min(u."ord") AS "ord"
    FROM unnest(d."region_codes") WITH ORDINALITY AS u("code", "ord")
    GROUP BY 1
  ) m
  ORDER BY m."ord"
)
WHERE EXISTS (
  SELECT 1 FROM unnest(d."region_codes") AS x("code")
  WHERE x."code" ~ '^(46|46150([0-9]{3}([0-9]{2})?)?)$'
);

-- 5. 국토교통부 단지 일련번호 (aptSeq "46150-1001") stored as complexes.external_code (unique):
--    rewritten unless the new value is already taken (the matcher canonicalizes both sides).
UPDATE "complexes" c
SET "external_code" = '12150-' || substr(c."external_code", 7)
WHERE c."external_code" LIKE '46150-%'
  AND NOT EXISTS (
    SELECT 1 FROM "complexes" o WHERE o."external_code" = '12150-' || substr(c."external_code", 7)
  );
