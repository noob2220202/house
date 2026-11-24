-- CreateTable
CREATE TABLE "favorite_agencies" (
    "user_id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_agencies_pkey" PRIMARY KEY ("user_id","agency_id")
);

-- CreateTable
CREATE TABLE "user_interest_regions" (
    "user_id" UUID NOT NULL,
    "region_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notify" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_interest_regions_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "policy_documents" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "policy_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favorite_agencies_agency_id_idx" ON "favorite_agencies"("agency_id");

-- CreateIndex
CREATE INDEX "favorite_agencies_user_id_created_at_idx" ON "favorite_agencies"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "policy_documents_slug_effective_at_idx" ON "policy_documents"("slug", "effective_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "policy_documents_slug_version_key" ON "policy_documents"("slug", "version");
