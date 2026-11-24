-- listings: 매물번호 (listing_no) + search groups for the 원룸·투룸 방 구성 and 토지 용도지역 / 지목 filters.

-- CreateEnum
CREATE TYPE "room_type" AS ENUM ('ONE_ROOM', 'ONE_HALF_ROOM', 'TWO_ROOM', 'THREE_ROOM_PLUS');

-- CreateEnum
CREATE TYPE "land_zone" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'GREEN', 'MANAGEMENT', 'AGRICULTURAL', 'CONSERVATION');

-- CreateEnum
CREATE TYPE "land_category" AS ENUM ('DAE', 'JEON', 'DAP', 'GWASUWON', 'IMYA', 'JAPJONGJI', 'ETC');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "land_category" "land_category",
ADD COLUMN     "land_zone" "land_zone",
ADD COLUMN     "room_type" "room_type";

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "room_type" "room_type";

-- 매물번호: same as `listing_no SERIAL NOT NULL` (Prisma autoincrement), but existing listings are
-- numbered in creation order and numbers start at 100001 so they read as a 매물번호, not a count.
CREATE SEQUENCE "listings_listing_no_seq" AS INTEGER START WITH 100001;
ALTER TABLE "listings" ADD COLUMN "listing_no" INTEGER;
UPDATE "listings" l SET "listing_no" = n.no
FROM (SELECT id, 100000 + row_number() OVER (ORDER BY created_at, id) AS no FROM "listings") n
WHERE n.id = l.id;
SELECT setval('listings_listing_no_seq', GREATEST(COALESCE(max("listing_no"), 0), 100000), true)
FROM "listings";
ALTER TABLE "listings"
  ALTER COLUMN "listing_no" SET DEFAULT nextval('listings_listing_no_seq'),
  ALTER COLUMN "listing_no" SET NOT NULL;
ALTER SEQUENCE "listings_listing_no_seq" OWNED BY "listings"."listing_no";

-- CreateIndex
CREATE UNIQUE INDEX "listings_listing_no_key" ON "listings"("listing_no");

-- Backfill the denormalized search groups (same rules as shared effectiveRoomType / landZoneOf /
-- landCategoryOf; the API keeps them in sync on every write from here on).
UPDATE "listings" l SET
  "room_type" = CASE
    WHEN l.asset_type = 'ONEROOM' AND l.rooms = 1 THEN 'ONE_ROOM'::room_type
    WHEN l.asset_type = 'ONEROOM' AND l.rooms = 2 THEN 'TWO_ROOM'::room_type
    WHEN l.asset_type = 'ONEROOM' AND l.rooms >= 3 THEN 'THREE_ROOM_PLUS'::room_type
  END,
  "land_zone" = CASE
    WHEN p.z IS NULL OR p.z = '' THEN NULL
    WHEN p.z IN ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'GREEN', 'MANAGEMENT', 'AGRICULTURAL', 'CONSERVATION')
      THEN p.z::land_zone
    WHEN p.z LIKE '%자연환경보전%' THEN 'CONSERVATION'::land_zone
    WHEN p.z LIKE '%녹지%' THEN 'GREEN'::land_zone
    WHEN p.z LIKE '%주거%' THEN 'RESIDENTIAL'::land_zone
    WHEN p.z LIKE '%상업%' THEN 'COMMERCIAL'::land_zone
    WHEN p.z LIKE '%공업%' THEN 'INDUSTRIAL'::land_zone
    WHEN p.z LIKE '%관리%' THEN 'MANAGEMENT'::land_zone
    WHEN p.z LIKE '%농림%' THEN 'AGRICULTURAL'::land_zone
  END,
  "land_category" = CASE
    WHEN p.c IS NULL OR p.c = '' THEN NULL
    WHEN p.c IN ('DAE', 'JEON', 'DAP', 'GWASUWON', 'IMYA', 'JAPJONGJI', 'ETC') THEN p.c::land_category
    WHEN p.c IN ('대', '대지') THEN 'DAE'::land_category
    WHEN p.c = '전' THEN 'JEON'::land_category
    WHEN p.c = '답' THEN 'DAP'::land_category
    WHEN p.c = '과수원' THEN 'GWASUWON'::land_category
    WHEN p.c = '임야' THEN 'IMYA'::land_category
    WHEN p.c = '잡종지' THEN 'JAPJONGJI'::land_category
    ELSE 'ETC'::land_category
  END
FROM (
  SELECT id,
         regexp_replace(zoning, '\s+', '', 'g') AS z,
         regexp_replace(land_category, '\s+', '', 'g') AS c
  FROM "properties"
) p
WHERE p.id = l.property_id;
