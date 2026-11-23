-- Initial schema for the 순천 부동산 platform.
-- Generated with `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema --script`,
-- plus the hand-written section at the end:
--   * every `location` geography(Point,4326) column is maintained from lat/lng by the
--     house_sync_location() trigger (Prisma models it as Unsupported(...) and never writes it).
--     A trigger is used instead of a GENERATED column because Prisma reports generated
--     expressions as drift. GIST indexes on `location` are declared in the Prisma schema.
--   * trigram (pg_trgm) GIN indexes are declared in the Prisma schema with ops: raw("gin_trgm_ops").
--   * CHECK constraints Prisma cannot express (lat/lng ranges, non-negative money).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "report_target_type" AS ENUM ('LISTING', 'AGENCY');

-- CreateEnum
CREATE TYPE "report_reason" AS ENUM ('NOT_EXIST', 'ALREADY_DEALT', 'WRONG_PRICE', 'WRONG_INFO', 'WRONG_PHOTO', 'DUPLICATE', 'UNREACHABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('RECEIVED', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "report_action" AS ENUM ('NONE', 'LISTING_HIDDEN', 'AGENCY_WARNED', 'LISTING_HIDDEN_AGENCY_WARNED');

-- CreateEnum
CREATE TYPE "faq_category" AS ENUM ('GENERAL', 'ACCOUNT', 'LISTING', 'AGENCY', 'DEAL_REQUEST', 'AD');

-- CreateEnum
CREATE TYPE "audit_actor_type" AS ENUM ('ADMIN', 'USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "banner_slot" AS ENUM ('MAIN_HERO', 'MAIN_STRIP', 'MAP_AD', 'COMPLEX_FEATURED_AGENCY', 'LISTING_SIDE', 'AGENCY_SEARCH_TOP', 'MOBILE_MAIN');

-- CreateEnum
CREATE TYPE "banner_targeting" AS ENUM ('ALL', 'REGIONS', 'COMPLEXES');

-- CreateEnum
CREATE TYPE "popup_page" AS ENUM ('ALL', 'MAIN', 'MAP', 'COMPLEX_DETAIL', 'LISTING_DETAIL', 'AGENCY_LIST', 'DEAL_REQUEST');

-- CreateEnum
CREATE TYPE "agency_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "agency_member_role" AS ENUM ('OWNER', 'AGENT');

-- CreateEnum
CREATE TYPE "agency_member_status" AS ENUM ('INVITED', 'ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "agency_document_type" AS ENUM ('REGISTRATION_CERT', 'BUSINESS_REG_CERT', 'BROKER_LICENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'AGENT', 'AGENCY_OWNER');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "auth_provider" AS ENUM ('KAKAO', 'NAVER', 'GOOGLE');

-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('OPERATOR', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "admin_status" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "terms_type" AS ENUM ('SERVICE', 'PRIVACY', 'LOCATION', 'MARKETING');

-- CreateEnum
CREATE TYPE "trade_deal_type" AS ENUM ('SALE', 'JEONSE', 'MONTHLY');

-- CreateEnum
CREATE TYPE "trade_sync_kind" AS ENUM ('APT_TRADE', 'APT_RENT');

-- CreateEnum
CREATE TYPE "trade_sync_status" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "region_level" AS ENUM ('SIDO', 'SGG', 'EMD', 'RI');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('DEAL_REQUEST_RECEIVED', 'PROPOSAL_RECEIVED', 'PROPOSAL_ACCEPTED', 'CONTACT_GRANTED', 'AGENCY_APPROVED', 'AGENCY_REJECTED', 'AGENCY_WARNED', 'LISTING_HIDDEN', 'REPORT_RESOLVED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "deal_request_type" AS ENUM ('SELL_OR_LEASE', 'WANTED');

-- CreateEnum
CREATE TYPE "deal_request_status" AS ENUM ('OPEN', 'MATCHED', 'CLOSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "deal_request_visibility" AS ENUM ('ALL_AGENCIES_IN_REGION', 'SELECTED_AGENCIES');

-- CreateEnum
CREATE TYPE "proposal_status" AS ENUM ('SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "asset_type" AS ENUM ('APT', 'OFFICETEL', 'ONEROOM', 'HOUSE', 'COMMERCIAL', 'LAND');

-- CreateEnum
CREATE TYPE "deal_type" AS ENUM ('SALE', 'JEONSE', 'MONTHLY', 'PRESALE');

-- CreateEnum
CREATE TYPE "listing_status" AS ENUM ('DRAFT', 'ACTIVE', 'RESERVED', 'CLOSED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "direction" AS ENUM ('EAST', 'WEST', 'SOUTH', 'NORTH', 'SOUTH_EAST', 'SOUTH_WEST', 'NORTH_EAST', 'NORTH_WEST');

-- CreateEnum
CREATE TYPE "direction_basis" AS ENUM ('LIVING_ROOM', 'MAIN_ROOM', 'ENTRANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "floor_class" AS ENUM ('LOW', 'MID', 'HIGH');

-- CreateEnum
CREATE TYPE "floor_display" AS ENUM ('EXACT', 'CLASS');

-- CreateEnum
CREATE TYPE "move_in_type" AS ENUM ('IMMEDIATE', 'NEGOTIABLE', 'DATE');

-- CreateEnum
CREATE TYPE "verification_method" AS ENUM ('OWNER_CONFIRMED', 'DOCUMENT', 'SITE_VISIT', 'OWNER_CALL', 'REGISTRY');

-- CreateEnum
CREATE TYPE "listing_option" AS ENUM ('AIR_CONDITIONER', 'REFRIGERATOR', 'WASHER', 'DRYER', 'BED', 'DESK', 'CLOSET', 'BUILT_IN_WARDROBE', 'SHOE_RACK', 'INDUCTION', 'GAS_RANGE', 'MICROWAVE', 'DISHWASHER', 'TV', 'WIFI', 'ELEVATOR', 'PARKING', 'PET_ALLOWED', 'SECURITY', 'CCTV', 'VERANDA', 'BALCONY');

-- CreateEnum
CREATE TYPE "listing_agency_status" AS ENUM ('ACTIVE', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "recent_view_target" AS ENUM ('LISTING', 'COMPLEX', 'AGENCY');

-- CreateEnum
CREATE TYPE "media_visibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "media_status" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "media_purpose" AS ENUM ('LISTING_PHOTO', 'COMPLEX_PHOTO', 'DEAL_REQUEST_PHOTO', 'AGENCY_LOGO', 'AGENCY_DOCUMENT', 'BANNER', 'POPUP', 'CONTENT', 'PROFILE');

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "target_type" "report_target_type" NOT NULL,
    "listing_id" UUID,
    "agency_id" UUID,
    "reporter_user_id" UUID,
    "reporter_phone" VARCHAR(20),
    "reason" "report_reason" NOT NULL,
    "detail" VARCHAR(2000),
    "status" "report_status" NOT NULL DEFAULT 'RECEIVED',
    "action" "report_action",
    "resolution_note" VARCHAR(2000),
    "handled_by_admin_id" UUID,
    "handled_at" TIMESTAMPTZ(3),
    "ip" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_type" "audit_actor_type" NOT NULL DEFAULT 'ADMIN',
    "admin_user_id" UUID,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" VARCHAR(64),
    "before" JSONB,
    "after" JSONB,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "request_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" UUID NOT NULL,
    "category" "faq_category" NOT NULL,
    "question" VARCHAR(500) NOT NULL,
    "answer" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_videos" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "youtube_url" VARCHAR(500) NOT NULL,
    "youtube_video_id" VARCHAR(20) NOT NULL,
    "thumbnail_url" VARCHAR(500),
    "description" VARCHAR(2000),
    "region_code" VARCHAR(10),
    "complex_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "local_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "key" VARCHAR(50) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_admin_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "banner_slot_configs" (
    "slot" "banner_slot" NOT NULL,
    "max_active" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "note" VARCHAR(500),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "banner_slot_configs_pkey" PRIMARY KEY ("slot")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" UUID NOT NULL,
    "slot" "banner_slot" NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "advertiser_name" VARCHAR(100),
    "agency_id" UUID,
    "pc_media_id" UUID NOT NULL,
    "mobile_media_id" UUID,
    "link_url" VARCHAR(2000),
    "new_window" BOOLEAN NOT NULL DEFAULT false,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "targeting" "banner_targeting" NOT NULL DEFAULT 'ALL',
    "memo" VARCHAR(1000),
    "created_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banner_target_regions" (
    "banner_id" UUID NOT NULL,
    "region_code" VARCHAR(10) NOT NULL,

    CONSTRAINT "banner_target_regions_pkey" PRIMARY KEY ("banner_id","region_code")
);

-- CreateTable
CREATE TABLE "banner_target_complexes" (
    "banner_id" UUID NOT NULL,
    "complex_id" UUID NOT NULL,

    CONSTRAINT "banner_target_complexes_pkey" PRIMARY KEY ("banner_id","complex_id")
);

-- CreateTable
CREATE TABLE "banner_stat_daily" (
    "banner_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "banner_stat_daily_pkey" PRIMARY KEY ("banner_id","date")
);

-- CreateTable
CREATE TABLE "popups" (
    "id" UUID NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "media_id" UUID NOT NULL,
    "link_url" VARCHAR(2000),
    "new_window" BOOLEAN NOT NULL DEFAULT false,
    "target_pages" "popup_page"[],
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "dismiss_days" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "popups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "representative_name" VARCHAR(50) NOT NULL,
    "registration_number" VARCHAR(40) NOT NULL,
    "business_number" VARCHAR(20),
    "phone" VARCHAR(20) NOT NULL,
    "mobile" VARCHAR(20),
    "email" VARCHAR(254),
    "road_address" VARCHAR(200) NOT NULL,
    "jibun_address" VARCHAR(200),
    "address_detail" VARCHAR(100),
    "zip_code" VARCHAR(10),
    "sgg_code" VARCHAR(5) NOT NULL,
    "emd_code" VARCHAR(10),
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "location" geography(Point, 4326),
    "intro" TEXT,
    "business_hours" JSONB,
    "specialties" "asset_type"[] DEFAULT ARRAY[]::"asset_type"[],
    "logo_media_id" UUID,
    "status" "agency_status" NOT NULL DEFAULT 'PENDING',
    "status_reason" VARCHAR(1000),
    "approved_at" TIMESTAMPTZ(3),
    "suspended_at" TIMESTAMPTZ(3),
    "active_listing_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_members" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "agency_member_role" NOT NULL DEFAULT 'AGENT',
    "status" "agency_member_status" NOT NULL DEFAULT 'ACTIVE',
    "display_name" VARCHAR(50) NOT NULL,
    "title" VARCHAR(30),
    "phone" VARCHAR(20),
    "is_licensed" BOOLEAN NOT NULL DEFAULT false,
    "license_number" VARCHAR(40),
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agency_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_documents" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "type" "agency_document_type" NOT NULL,
    "media_id" UUID NOT NULL,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_status_history" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "from_status" "agency_status",
    "to_status" "agency_status" NOT NULL,
    "reason" VARCHAR(1000),
    "decided_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_warnings" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "report_id" UUID,
    "admin_id" UUID,
    "reason" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254),
    "name" VARCHAR(50),
    "nickname" VARCHAR(30),
    "phone" VARCHAR(20),
    "profile_image_url" VARCHAR(1000),
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "marketing_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ(3),
    "suspended_at" TIMESTAMPTZ(3),
    "suspended_reason" VARCHAR(500),
    "withdrawn_at" TIMESTAMPTZ(3),
    "withdrawal_reason" VARCHAR(500),
    "pii_scrub_after" TIMESTAMPTZ(3),
    "pii_scrubbed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "auth_provider" NOT NULL,
    "provider_user_id" VARCHAR(255) NOT NULL,
    "email" VARCHAR(254),
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "profile" JSONB,
    "last_used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "role" "admin_role" NOT NULL DEFAULT 'OPERATOR',
    "status" "admin_status" NOT NULL DEFAULT 'ACTIVE',
    "totp_secret_enc" VARCHAR(500),
    "totp_enabled_at" TIMESTAMPTZ(3),
    "recovery_code_hashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ip_allowlist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "password_changed_at" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "last_login_ip" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms_documents" (
    "id" UUID NOT NULL,
    "type" "terms_type" NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "terms_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "terms_document_id" UUID NOT NULL,
    "agreed" BOOLEAN NOT NULL,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complexes" (
    "id" UUID NOT NULL,
    "asset_type" "asset_type" NOT NULL DEFAULT 'APT',
    "name" VARCHAR(100) NOT NULL,
    "road_address" VARCHAR(200),
    "jibun_address" VARCHAR(200),
    "sgg_code" VARCHAR(5) NOT NULL,
    "emd_code" VARCHAR(10),
    "emd_name" VARCHAR(50),
    "jibun" VARCHAR(20),
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "location" geography(Point, 4326),
    "households" INTEGER,
    "buildings" INTEGER,
    "floors_min" INTEGER,
    "floors_max" INTEGER,
    "approval_date" DATE,
    "built_year" INTEGER,
    "parking_total" INTEGER,
    "parking_per_household" DECIMAL(5,2),
    "floor_area_ratio" DECIMAL(7,2),
    "building_coverage_ratio" DECIMAL(5,2),
    "heating_type" VARCHAR(50),
    "builder" VARCHAR(100),
    "external_code" VARCHAR(40),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "active_listing_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "complexes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complex_area_types" (
    "id" UUID NOT NULL,
    "complex_id" UUID NOT NULL,
    "exclusive_area" DECIMAL(10,2) NOT NULL,
    "supply_area" DECIMAL(10,2),
    "type_name" VARCHAR(20) NOT NULL DEFAULT '',
    "pyeong_label" VARCHAR(20),
    "households" INTEGER,
    "rooms" INTEGER,
    "baths" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "complex_area_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complex_photos" (
    "id" UUID NOT NULL,
    "complex_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "caption" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complex_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_records" (
    "id" UUID NOT NULL,
    "source_key" VARCHAR(64) NOT NULL,
    "kind" "trade_sync_kind" NOT NULL,
    "complex_id" UUID,
    "area_type_id" UUID,
    "sgg_code" VARCHAR(5) NOT NULL,
    "emd_name" VARCHAR(50),
    "apt_name" VARCHAR(100) NOT NULL,
    "jibun" VARCHAR(20),
    "deal_type" "trade_deal_type" NOT NULL,
    "deal_date" DATE NOT NULL,
    "deal_ym" INTEGER NOT NULL,
    "exclusive_area" DECIMAL(10,2) NOT NULL,
    "floor" INTEGER,
    "price" INTEGER,
    "deposit" INTEGER,
    "monthly_rent" INTEGER,
    "built_year" INTEGER,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" DATE,
    "contract_type" VARCHAR(10),
    "raw" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trade_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complex_trade_stats" (
    "id" UUID NOT NULL,
    "complex_id" UUID NOT NULL,
    "exclusive_area" DECIMAL(10,2) NOT NULL,
    "deal_type" "trade_deal_type" NOT NULL,
    "year_month" INTEGER NOT NULL,
    "trade_count" INTEGER NOT NULL,
    "median_price" INTEGER NOT NULL,
    "min_price" INTEGER NOT NULL,
    "max_price" INTEGER NOT NULL,
    "avg_price" INTEGER NOT NULL,
    "median_monthly_rent" INTEGER,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "complex_trade_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_sync_runs" (
    "id" UUID NOT NULL,
    "kind" "trade_sync_kind" NOT NULL,
    "sgg_code" VARCHAR(5) NOT NULL,
    "year_month" INTEGER NOT NULL,
    "status" "trade_sync_status" NOT NULL DEFAULT 'RUNNING',
    "fetched_count" INTEGER NOT NULL DEFAULT 0,
    "upserted_count" INTEGER NOT NULL DEFAULT 0,
    "matched_count" INTEGER NOT NULL DEFAULT 0,
    "error" VARCHAR(2000),
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "trade_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_complexes" (
    "user_id" UUID NOT NULL,
    "complex_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_complexes_pkey" PRIMARY KEY ("user_id","complex_id")
);

-- CreateTable
CREATE TABLE "regions" (
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "level" "region_level" NOT NULL,
    "parent_code" VARCHAR(10),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "location" geography(Point, 4326),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(1000),
    "data" JSONB,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_requests" (
    "id" UUID NOT NULL,
    "type" "deal_request_type" NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "deal_request_status" NOT NULL DEFAULT 'OPEN',
    "asset_type" "asset_type" NOT NULL,
    "deal_types" "deal_type"[],
    "visibility" "deal_request_visibility" NOT NULL,
    "sgg_code" VARCHAR(5) NOT NULL,
    "contact_name" VARCHAR(30) NOT NULL,
    "contact_phone" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "road_address" VARCHAR(200),
    "address_detail" VARCHAR(100),
    "emd_code" VARCHAR(10),
    "complex_id" UUID,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "location" geography(Point, 4326),
    "exclusive_area" DECIMAL(10,2),
    "floor" INTEGER,
    "desired_sale_price" INTEGER,
    "desired_deposit" INTEGER,
    "desired_monthly_rent" INTEGER,
    "region_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "complex_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "price_min" INTEGER,
    "price_max" INTEGER,
    "deposit_min" INTEGER,
    "deposit_max" INTEGER,
    "rent_min" INTEGER,
    "rent_max" INTEGER,
    "area_min" DECIMAL(10,2),
    "area_max" DECIMAL(10,2),
    "rooms_min" INTEGER,
    "move_in_date" DATE,
    "expires_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "proposal_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "deal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_request_targets" (
    "deal_request_id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_request_targets_pkey" PRIMARY KEY ("deal_request_id","agency_id")
);

-- CreateTable
CREATE TABLE "deal_request_photos" (
    "id" UUID NOT NULL,
    "deal_request_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_request_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" UUID NOT NULL,
    "deal_request_id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "member_id" UUID,
    "message" VARCHAR(2000) NOT NULL,
    "status" "proposal_status" NOT NULL DEFAULT 'SENT',
    "viewed_at" TIMESTAMPTZ(3),
    "responded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_listings" (
    "proposal_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,

    CONSTRAINT "proposal_listings_pkey" PRIMARY KEY ("proposal_id","listing_id")
);

-- CreateTable
CREATE TABLE "deal_request_contact_grants" (
    "deal_request_id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "deal_request_contact_grants_pkey" PRIMARY KEY ("deal_request_id","agency_id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "asset_type" "asset_type" NOT NULL,
    "complex_id" UUID,
    "area_type_id" UUID,
    "road_address" VARCHAR(200) NOT NULL,
    "jibun_address" VARCHAR(200),
    "building_name" VARCHAR(100),
    "dong" VARCHAR(20),
    "ho" VARCHAR(20),
    "sgg_code" VARCHAR(5) NOT NULL,
    "emd_code" VARCHAR(10),
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "location" geography(Point, 4326),
    "floor" INTEGER,
    "total_floors" INTEGER,
    "exclusive_area" DECIMAL(10,2),
    "supply_area" DECIMAL(10,2),
    "land_area" DECIMAL(12,2),
    "total_floor_area" DECIMAL(12,2),
    "rooms" INTEGER,
    "baths" INTEGER,
    "direction" "direction",
    "direction_basis" "direction_basis",
    "approval_date" DATE,
    "parking_spaces" INTEGER,
    "heating_type" VARCHAR(50),
    "zoning" VARCHAR(50),
    "land_category" VARCHAR(20),
    "building_use" VARCHAR(50),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "deal_type" "deal_type" NOT NULL,
    "status" "listing_status" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(80),
    "description" TEXT,
    "sale_price" INTEGER,
    "deposit" INTEGER,
    "monthly_rent" INTEGER,
    "presale_price" INTEGER,
    "premium" INTEGER,
    "maintenance_fee_won" INTEGER,
    "maintenance_fee_items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "move_in_type" "move_in_type",
    "move_in_date" DATE,
    "floor_display" "floor_display" NOT NULL DEFAULT 'EXACT',
    "options" "listing_option"[] DEFAULT ARRAY[]::"listing_option"[],
    "primary_agency_id" UUID NOT NULL,
    "created_by_id" UUID,
    "published_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "hidden_reason" VARCHAR(500),
    "verified_at" TIMESTAMPTZ(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "asset_type" "asset_type" NOT NULL,
    "complex_id" UUID,
    "sgg_code" VARCHAR(5) NOT NULL,
    "emd_code" VARCHAR(10),
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "location" geography(Point, 4326),
    "exclusive_area" DECIMAL(10,2),
    "rooms" INTEGER,
    "baths" INTEGER,
    "direction" "direction",
    "floor_class" "floor_class",
    "built_year" INTEGER,
    "price_sort" INTEGER,
    "photo_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_agencies" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" "listing_agency_status" NOT NULL DEFAULT 'ACTIVE',
    "contact_member_id" UUID,
    "contact_name" VARCHAR(50),
    "contact_phone" VARCHAR(20),
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMPTZ(3),

    CONSTRAINT "listing_agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_photos" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "caption" VARCHAR(100),
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_verifications" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "method" "verification_method" NOT NULL,
    "verified_at" TIMESTAMPTZ(3) NOT NULL,
    "verified_by_user_id" UUID,
    "verified_by_admin_id" UUID,
    "note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_listings" (
    "user_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_listings_pkey" PRIMARY KEY ("user_id","listing_id")
);

-- CreateTable
CREATE TABLE "recent_views" (
    "user_id" UUID NOT NULL,
    "target_type" "recent_view_target" NOT NULL,
    "target_id" UUID NOT NULL,
    "viewed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recent_views_pkey" PRIMARY KEY ("user_id","target_type","target_id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "purpose" "media_purpose" NOT NULL,
    "visibility" "media_visibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "media_status" NOT NULL DEFAULT 'PENDING',
    "owner_user_id" UUID,
    "owner_admin_id" UUID,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" VARCHAR(64) NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "variants" JSONB,
    "original_filename" VARCHAR(255),
    "error" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reports_listing_id_idx" ON "reports"("listing_id");

-- CreateIndex
CREATE INDEX "reports_agency_id_idx" ON "reports"("agency_id");

-- CreateIndex
CREATE INDEX "reports_reporter_user_id_idx" ON "reports"("reporter_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_created_at_idx" ON "audit_logs"("resource_type", "resource_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_admin_user_id_created_at_idx" ON "audit_logs"("admin_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "notices_is_published_is_pinned_published_at_idx" ON "notices"("is_published", "is_pinned", "published_at" DESC);

-- CreateIndex
CREATE INDEX "faqs_is_published_category_sort_order_idx" ON "faqs"("is_published", "category", "sort_order");

-- CreateIndex
CREATE INDEX "local_videos_is_published_sort_order_idx" ON "local_videos"("is_published", "sort_order");

-- CreateIndex
CREATE INDEX "local_videos_complex_id_idx" ON "local_videos"("complex_id");

-- CreateIndex
CREATE INDEX "banners_slot_start_at_end_at_idx" ON "banners"("slot", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "banners_slot_sort_order_idx" ON "banners"("slot", "sort_order");

-- CreateIndex
CREATE INDEX "banners_agency_id_idx" ON "banners"("agency_id");

-- CreateIndex
CREATE INDEX "banner_target_regions_region_code_idx" ON "banner_target_regions"("region_code");

-- CreateIndex
CREATE INDEX "banner_target_complexes_complex_id_idx" ON "banner_target_complexes"("complex_id");

-- CreateIndex
CREATE INDEX "banner_stat_daily_date_idx" ON "banner_stat_daily"("date");

-- CreateIndex
CREATE INDEX "popups_start_at_end_at_idx" ON "popups"("start_at", "end_at");

-- CreateIndex
CREATE INDEX "popups_target_pages_idx" ON "popups" USING GIN ("target_pages");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_registration_number_key" ON "agencies"("registration_number");

-- CreateIndex
CREATE INDEX "agencies_status_sgg_code_idx" ON "agencies"("status", "sgg_code");

-- CreateIndex
CREATE INDEX "agencies_emd_code_status_idx" ON "agencies"("emd_code", "status");

-- CreateIndex
CREATE INDEX "agencies_owner_user_id_idx" ON "agencies"("owner_user_id");

-- CreateIndex
CREATE INDEX "agencies_location_idx" ON "agencies" USING GIST ("location");

-- CreateIndex
CREATE INDEX "agencies_name_trgm_idx" ON "agencies" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "agencies_road_address_trgm_idx" ON "agencies" USING GIN ("road_address" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "agency_members_user_id_status_idx" ON "agency_members"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agency_members_agency_id_user_id_key" ON "agency_members"("agency_id", "user_id");

-- CreateIndex
CREATE INDEX "agency_documents_agency_id_type_idx" ON "agency_documents"("agency_id", "type");

-- CreateIndex
CREATE INDEX "agency_status_history_agency_id_created_at_idx" ON "agency_status_history"("agency_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "agency_warnings_agency_id_created_at_idx" ON "agency_warnings"("agency_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_status_created_at_idx" ON "users"("status", "created_at");

-- CreateIndex
CREATE INDEX "users_pii_scrub_after_idx" ON "users"("pii_scrub_after");

-- CreateIndex
CREATE INDEX "identities_user_id_idx" ON "identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "identities_provider_provider_user_id_key" ON "identities"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "terms_documents_type_effective_at_idx" ON "terms_documents"("type", "effective_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "terms_documents_type_version_key" ON "terms_documents"("type", "version");

-- CreateIndex
CREATE INDEX "user_consents_user_id_terms_document_id_created_at_idx" ON "user_consents"("user_id", "terms_document_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_consents_terms_document_id_idx" ON "user_consents"("terms_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "complexes_external_code_key" ON "complexes"("external_code");

-- CreateIndex
CREATE INDEX "complexes_sgg_code_emd_code_idx" ON "complexes"("sgg_code", "emd_code");

-- CreateIndex
CREATE INDEX "complexes_sgg_code_view_count_idx" ON "complexes"("sgg_code", "view_count" DESC);

-- CreateIndex
CREATE INDEX "complexes_location_idx" ON "complexes" USING GIST ("location");

-- CreateIndex
CREATE INDEX "complexes_name_trgm_idx" ON "complexes" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "complexes_road_address_trgm_idx" ON "complexes" USING GIN ("road_address" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "complex_area_types_complex_id_exclusive_area_type_name_key" ON "complex_area_types"("complex_id", "exclusive_area", "type_name");

-- CreateIndex
CREATE INDEX "complex_photos_complex_id_sort_order_idx" ON "complex_photos"("complex_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "complex_photos_complex_id_media_id_key" ON "complex_photos"("complex_id", "media_id");

-- CreateIndex
CREATE UNIQUE INDEX "trade_records_source_key_key" ON "trade_records"("source_key");

-- CreateIndex
CREATE INDEX "trade_records_complex_id_deal_type_deal_date_idx" ON "trade_records"("complex_id", "deal_type", "deal_date" DESC);

-- CreateIndex
CREATE INDEX "trade_records_area_type_id_deal_type_deal_date_idx" ON "trade_records"("area_type_id", "deal_type", "deal_date" DESC);

-- CreateIndex
CREATE INDEX "trade_records_sgg_code_deal_ym_idx" ON "trade_records"("sgg_code", "deal_ym");

-- CreateIndex
CREATE INDEX "complex_trade_stats_complex_id_deal_type_year_month_idx" ON "complex_trade_stats"("complex_id", "deal_type", "year_month" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "complex_trade_stats_complex_id_exclusive_area_deal_type_yea_key" ON "complex_trade_stats"("complex_id", "exclusive_area", "deal_type", "year_month");

-- CreateIndex
CREATE INDEX "trade_sync_runs_kind_sgg_code_year_month_started_at_idx" ON "trade_sync_runs"("kind", "sgg_code", "year_month", "started_at" DESC);

-- CreateIndex
CREATE INDEX "favorite_complexes_complex_id_idx" ON "favorite_complexes"("complex_id");

-- CreateIndex
CREATE INDEX "favorite_complexes_user_id_created_at_idx" ON "favorite_complexes"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "regions_parent_code_idx" ON "regions"("parent_code");

-- CreateIndex
CREATE INDEX "regions_level_is_active_idx" ON "regions"("level", "is_active");

-- CreateIndex
CREATE INDEX "regions_location_idx" ON "regions" USING GIST ("location");

-- CreateIndex
CREATE INDEX "regions_name_trgm_idx" ON "regions" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "deal_requests_user_id_created_at_idx" ON "deal_requests"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "deal_requests_status_sgg_code_type_created_at_idx" ON "deal_requests"("status", "sgg_code", "type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "deal_requests_emd_code_status_idx" ON "deal_requests"("emd_code", "status");

-- CreateIndex
CREATE INDEX "deal_requests_complex_id_status_idx" ON "deal_requests"("complex_id", "status");

-- CreateIndex
CREATE INDEX "deal_requests_region_codes_idx" ON "deal_requests" USING GIN ("region_codes");

-- CreateIndex
CREATE INDEX "deal_requests_expires_at_idx" ON "deal_requests"("expires_at");

-- CreateIndex
CREATE INDEX "deal_requests_location_idx" ON "deal_requests" USING GIST ("location");

-- CreateIndex
CREATE INDEX "deal_request_targets_agency_id_created_at_idx" ON "deal_request_targets"("agency_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "deal_request_photos_deal_request_id_media_id_key" ON "deal_request_photos"("deal_request_id", "media_id");

-- CreateIndex
CREATE INDEX "proposals_agency_id_created_at_idx" ON "proposals"("agency_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "proposals_deal_request_id_agency_id_key" ON "proposals"("deal_request_id", "agency_id");

-- CreateIndex
CREATE INDEX "proposal_listings_listing_id_idx" ON "proposal_listings"("listing_id");

-- CreateIndex
CREATE INDEX "deal_request_contact_grants_agency_id_idx" ON "deal_request_contact_grants"("agency_id");

-- CreateIndex
CREATE INDEX "properties_complex_id_idx" ON "properties"("complex_id");

-- CreateIndex
CREATE INDEX "properties_sgg_code_emd_code_idx" ON "properties"("sgg_code", "emd_code");

-- CreateIndex
CREATE INDEX "properties_location_idx" ON "properties" USING GIST ("location");

-- CreateIndex
CREATE INDEX "properties_road_address_trgm_idx" ON "properties" USING GIN ("road_address" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "listings_status_deal_type_asset_type_idx" ON "listings"("status", "deal_type", "asset_type");

-- CreateIndex
CREATE INDEX "listings_status_published_at_idx" ON "listings"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "listings_status_price_sort_idx" ON "listings"("status", "price_sort");

-- CreateIndex
CREATE INDEX "listings_status_exclusive_area_idx" ON "listings"("status", "exclusive_area");

-- CreateIndex
CREATE INDEX "listings_status_verified_at_idx" ON "listings"("status", "verified_at" DESC);

-- CreateIndex
CREATE INDEX "listings_status_built_year_idx" ON "listings"("status", "built_year" DESC);

-- CreateIndex
CREATE INDEX "listings_status_photo_count_idx" ON "listings"("status", "photo_count" DESC);

-- CreateIndex
CREATE INDEX "listings_complex_id_status_deal_type_idx" ON "listings"("complex_id", "status", "deal_type");

-- CreateIndex
CREATE INDEX "listings_primary_agency_id_status_idx" ON "listings"("primary_agency_id", "status");

-- CreateIndex
CREATE INDEX "listings_emd_code_status_idx" ON "listings"("emd_code", "status");

-- CreateIndex
CREATE INDEX "listings_property_id_idx" ON "listings"("property_id");

-- CreateIndex
CREATE INDEX "listings_created_by_id_idx" ON "listings"("created_by_id");

-- CreateIndex
CREATE INDEX "listings_location_idx" ON "listings" USING GIST ("location");

-- CreateIndex
CREATE INDEX "listing_agencies_agency_id_status_idx" ON "listing_agencies"("agency_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "listing_agencies_listing_id_agency_id_key" ON "listing_agencies"("listing_id", "agency_id");

-- CreateIndex
CREATE INDEX "listing_photos_listing_id_sort_order_idx" ON "listing_photos"("listing_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "listing_photos_listing_id_media_id_key" ON "listing_photos"("listing_id", "media_id");

-- CreateIndex
CREATE INDEX "listing_verifications_listing_id_verified_at_idx" ON "listing_verifications"("listing_id", "verified_at" DESC);

-- CreateIndex
CREATE INDEX "favorite_listings_listing_id_idx" ON "favorite_listings"("listing_id");

-- CreateIndex
CREATE INDEX "favorite_listings_user_id_created_at_idx" ON "favorite_listings"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "recent_views_user_id_viewed_at_idx" ON "recent_views"("user_id", "viewed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "media_storage_key_key" ON "media"("storage_key");

-- CreateIndex
CREATE INDEX "media_owner_user_id_created_at_idx" ON "media"("owner_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "media_status_created_at_idx" ON "media"("status", "created_at");

-- CreateIndex
CREATE INDEX "media_sha256_idx" ON "media"("sha256");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_handled_by_admin_id_fkey" FOREIGN KEY ("handled_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_videos" ADD CONSTRAINT "local_videos_complex_id_fkey" FOREIGN KEY ("complex_id") REFERENCES "complexes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_admin_id_fkey" FOREIGN KEY ("updated_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_pc_media_id_fkey" FOREIGN KEY ("pc_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_mobile_media_id_fkey" FOREIGN KEY ("mobile_media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banner_target_regions" ADD CONSTRAINT "banner_target_regions_banner_id_fkey" FOREIGN KEY ("banner_id") REFERENCES "banners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banner_target_complexes" ADD CONSTRAINT "banner_target_complexes_banner_id_fkey" FOREIGN KEY ("banner_id") REFERENCES "banners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banner_target_complexes" ADD CONSTRAINT "banner_target_complexes_complex_id_fkey" FOREIGN KEY ("complex_id") REFERENCES "complexes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banner_stat_daily" ADD CONSTRAINT "banner_stat_daily_banner_id_fkey" FOREIGN KEY ("banner_id") REFERENCES "banners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "popups" ADD CONSTRAINT "popups_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "popups" ADD CONSTRAINT "popups_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_logo_media_id_fkey" FOREIGN KEY ("logo_media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_members" ADD CONSTRAINT "agency_members_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_members" ADD CONSTRAINT "agency_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_documents" ADD CONSTRAINT "agency_documents_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_documents" ADD CONSTRAINT "agency_documents_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_documents" ADD CONSTRAINT "agency_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_status_history" ADD CONSTRAINT "agency_status_history_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_status_history" ADD CONSTRAINT "agency_status_history_decided_by_admin_id_fkey" FOREIGN KEY ("decided_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_warnings" ADD CONSTRAINT "agency_warnings_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_warnings" ADD CONSTRAINT "agency_warnings_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_warnings" ADD CONSTRAINT "agency_warnings_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identities" ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_terms_document_id_fkey" FOREIGN KEY ("terms_document_id") REFERENCES "terms_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complex_area_types" ADD CONSTRAINT "complex_area_types_complex_id_fkey" FOREIGN KEY ("complex_id") REFERENCES "complexes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complex_photos" ADD CONSTRAINT "complex_photos_complex_id_fkey" FOREIGN KEY ("complex_id") REFERENCES "complexes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complex_photos" ADD CONSTRAINT "complex_photos_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_records" ADD CONSTRAINT "trade_records_complex_id_fkey" FOREIGN KEY ("complex_id") REFERENCES "complexes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_records" ADD CONSTRAINT "trade_records_area_type_id_fkey" FOREIGN KEY ("area_type_id") REFERENCES "complex_area_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complex_trade_stats" ADD CONSTRAINT "complex_trade_stats_complex_id_fkey" FOREIGN KEY ("complex_id") REFERENCES "complexes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_complexes" ADD CONSTRAINT "favorite_complexes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_complexes" ADD CONSTRAINT "favorite_complexes_complex_id_fkey" FOREIGN KEY ("complex_id") REFERENCES "complexes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_parent_code_fkey" FOREIGN KEY ("parent_code") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_requests" ADD CONSTRAINT "deal_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_requests" ADD CONSTRAINT "deal_requests_complex_id_fkey" FOREIGN KEY ("complex_id") REFERENCES "complexes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_request_targets" ADD CONSTRAINT "deal_request_targets_deal_request_id_fkey" FOREIGN KEY ("deal_request_id") REFERENCES "deal_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_request_targets" ADD CONSTRAINT "deal_request_targets_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_request_photos" ADD CONSTRAINT "deal_request_photos_deal_request_id_fkey" FOREIGN KEY ("deal_request_id") REFERENCES "deal_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_request_photos" ADD CONSTRAINT "deal_request_photos_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_deal_request_id_fkey" FOREIGN KEY ("deal_request_id") REFERENCES "deal_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "agency_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_listings" ADD CONSTRAINT "proposal_listings_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_listings" ADD CONSTRAINT "proposal_listings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_request_contact_grants" ADD CONSTRAINT "deal_request_contact_grants_deal_request_id_fkey" FOREIGN KEY ("deal_request_id") REFERENCES "deal_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_request_contact_grants" ADD CONSTRAINT "deal_request_contact_grants_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_complex_id_fkey" FOREIGN KEY ("complex_id") REFERENCES "complexes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_area_type_id_fkey" FOREIGN KEY ("area_type_id") REFERENCES "complex_area_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_primary_agency_id_fkey" FOREIGN KEY ("primary_agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_complex_id_fkey" FOREIGN KEY ("complex_id") REFERENCES "complexes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_agencies" ADD CONSTRAINT "listing_agencies_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_agencies" ADD CONSTRAINT "listing_agencies_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_agencies" ADD CONSTRAINT "listing_agencies_contact_member_id_fkey" FOREIGN KEY ("contact_member_id") REFERENCES "agency_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_verifications" ADD CONSTRAINT "listing_verifications_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_verifications" ADD CONSTRAINT "listing_verifications_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_verifications" ADD CONSTRAINT "listing_verifications_verified_by_admin_id_fkey" FOREIGN KEY ("verified_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_listings" ADD CONSTRAINT "favorite_listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_listings" ADD CONSTRAINT "favorite_listings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recent_views" ADD CONSTRAINT "recent_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_owner_admin_id_fkey" FOREIGN KEY ("owner_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- PostGIS: keep `location` in sync with lat/lng
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION house_sync_location() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lat IS NULL OR NEW.lng IS NULL THEN
    NEW.location := NULL;
  ELSE
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "regions_sync_location"
  BEFORE INSERT OR UPDATE OF lat, lng, location ON "regions"
  FOR EACH ROW EXECUTE FUNCTION house_sync_location();

CREATE TRIGGER "agencies_sync_location"
  BEFORE INSERT OR UPDATE OF lat, lng, location ON "agencies"
  FOR EACH ROW EXECUTE FUNCTION house_sync_location();

CREATE TRIGGER "complexes_sync_location"
  BEFORE INSERT OR UPDATE OF lat, lng, location ON "complexes"
  FOR EACH ROW EXECUTE FUNCTION house_sync_location();

CREATE TRIGGER "properties_sync_location"
  BEFORE INSERT OR UPDATE OF lat, lng, location ON "properties"
  FOR EACH ROW EXECUTE FUNCTION house_sync_location();

CREATE TRIGGER "listings_sync_location"
  BEFORE INSERT OR UPDATE OF lat, lng, location ON "listings"
  FOR EACH ROW EXECUTE FUNCTION house_sync_location();

CREATE TRIGGER "deal_requests_sync_location"
  BEFORE INSERT OR UPDATE OF lat, lng, location ON "deal_requests"
  FOR EACH ROW EXECUTE FUNCTION house_sync_location();

-- ---------------------------------------------------------------------------
-- CHECK constraints (Prisma has no syntax for these; they never show up as drift)
-- ---------------------------------------------------------------------------
ALTER TABLE "agencies"   ADD CONSTRAINT "agencies_lat_lng_chk"   CHECK (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180);
ALTER TABLE "complexes"  ADD CONSTRAINT "complexes_lat_lng_chk"  CHECK (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180);
ALTER TABLE "properties" ADD CONSTRAINT "properties_lat_lng_chk" CHECK (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180);
ALTER TABLE "listings"   ADD CONSTRAINT "listings_lat_lng_chk"   CHECK (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180);
ALTER TABLE "listings"   ADD CONSTRAINT "listings_prices_chk"    CHECK (
  (sale_price IS NULL OR sale_price >= 0) AND (deposit IS NULL OR deposit >= 0) AND
  (monthly_rent IS NULL OR monthly_rent >= 0) AND (presale_price IS NULL OR presale_price >= 0) AND
  (maintenance_fee_won IS NULL OR maintenance_fee_won >= 0)
);
ALTER TABLE "banners" ADD CONSTRAINT "banners_window_chk" CHECK (start_at < end_at);
ALTER TABLE "popups"  ADD CONSTRAINT "popups_window_chk"  CHECK (start_at < end_at);

-- At most one primary agency per listing (co-brokerage invariant).
CREATE UNIQUE INDEX "listing_agencies_one_primary_idx" ON "listing_agencies" ("listing_id") WHERE "is_primary";
