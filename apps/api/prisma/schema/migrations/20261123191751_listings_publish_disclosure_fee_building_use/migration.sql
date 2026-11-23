-- listings: publish_disclosure_fee_building_use
-- CreateEnum
CREATE TYPE "building_use" AS ENUM ('DETACHED_HOUSE', 'MULTI_UNIT_HOUSE', 'MULTI_FAMILY_HOUSE', 'OFFICIAL_RESIDENCE', 'APARTMENT', 'ROW_HOUSE', 'MULTIPLEX_HOUSE', 'DORMITORY', 'NEIGHBORHOOD_FACILITY_1', 'NEIGHBORHOOD_FACILITY_2', 'CULTURE_ASSEMBLY', 'RELIGIOUS', 'SALES', 'TRANSPORTATION', 'MEDICAL', 'EDUCATION_RESEARCH', 'ELDERLY_CHILD', 'TRAINING', 'SPORTS', 'OFFICE', 'OFFICETEL', 'LODGING', 'AMUSEMENT', 'FACTORY', 'WAREHOUSE', 'HAZARDOUS_MATERIAL', 'AUTOMOBILE', 'ANIMAL_PLANT', 'RESOURCE_RECYCLING', 'CORRECTIONAL_MILITARY', 'BROADCASTING', 'POWER_PLANT', 'CEMETERY', 'TOURIST_REST', 'FUNERAL', 'CAMPING');

-- AlterTable: the old free-text 관리비 항목 had no amounts or billing type and cannot be mapped
-- to the structured breakdown; agents re-enter it (publish requires it when 관리비 > 0).
ALTER TABLE "listings" DROP COLUMN "maintenance_fee_items",
ADD COLUMN     "maintenance_fee" JSONB;

-- AlterTable: free-text 건축물 용도 → enum. Exact 별표1 labels (spaces ignored) are kept, anything
-- else becomes NULL and the agent must pick a use before the next publish.
ALTER TABLE "properties" ALTER COLUMN "building_use" TYPE "building_use" USING (
  CASE replace("building_use", ' ', '')
    WHEN '단독주택' THEN 'DETACHED_HOUSE'::"building_use"
    WHEN '다중주택' THEN 'MULTI_UNIT_HOUSE'::"building_use"
    WHEN '다가구주택' THEN 'MULTI_FAMILY_HOUSE'::"building_use"
    WHEN '공관' THEN 'OFFICIAL_RESIDENCE'::"building_use"
    WHEN '아파트' THEN 'APARTMENT'::"building_use"
    WHEN '연립주택' THEN 'ROW_HOUSE'::"building_use"
    WHEN '다세대주택' THEN 'MULTIPLEX_HOUSE'::"building_use"
    WHEN '기숙사' THEN 'DORMITORY'::"building_use"
    WHEN '제1종근린생활시설' THEN 'NEIGHBORHOOD_FACILITY_1'::"building_use"
    WHEN '제2종근린생활시설' THEN 'NEIGHBORHOOD_FACILITY_2'::"building_use"
    WHEN '문화및집회시설' THEN 'CULTURE_ASSEMBLY'::"building_use"
    WHEN '종교시설' THEN 'RELIGIOUS'::"building_use"
    WHEN '판매시설' THEN 'SALES'::"building_use"
    WHEN '운수시설' THEN 'TRANSPORTATION'::"building_use"
    WHEN '의료시설' THEN 'MEDICAL'::"building_use"
    WHEN '교육연구시설' THEN 'EDUCATION_RESEARCH'::"building_use"
    WHEN '노유자시설' THEN 'ELDERLY_CHILD'::"building_use"
    WHEN '수련시설' THEN 'TRAINING'::"building_use"
    WHEN '운동시설' THEN 'SPORTS'::"building_use"
    WHEN '업무시설' THEN 'OFFICE'::"building_use"
    WHEN '오피스텔' THEN 'OFFICETEL'::"building_use"
    WHEN '숙박시설' THEN 'LODGING'::"building_use"
    WHEN '위락시설' THEN 'AMUSEMENT'::"building_use"
    WHEN '공장' THEN 'FACTORY'::"building_use"
    WHEN '창고시설' THEN 'WAREHOUSE'::"building_use"
    WHEN '위험물저장및처리시설' THEN 'HAZARDOUS_MATERIAL'::"building_use"
    WHEN '자동차관련시설' THEN 'AUTOMOBILE'::"building_use"
    WHEN '동물및식물관련시설' THEN 'ANIMAL_PLANT'::"building_use"
    WHEN '자원순환관련시설' THEN 'RESOURCE_RECYCLING'::"building_use"
    WHEN '교정및군사시설' THEN 'CORRECTIONAL_MILITARY'::"building_use"
    WHEN '방송통신시설' THEN 'BROADCASTING'::"building_use"
    WHEN '발전시설' THEN 'POWER_PLANT'::"building_use"
    WHEN '묘지관련시설' THEN 'CEMETERY'::"building_use"
    WHEN '관광휴게시설' THEN 'TOURIST_REST'::"building_use"
    WHEN '장례시설' THEN 'FUNERAL'::"building_use"
    WHEN '야영장시설' THEN 'CAMPING'::"building_use"
    ELSE NULL
  END
);
