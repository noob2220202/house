-- inquiries: init
-- 문의 (SPEC §2, §3.5): written inquiries from members and guests to an office, the office's
-- answers / customer follow-ups (inquiry_messages), and contact events (CALL / SMS / COPY, no PII).
-- New tables only. Listings / users are SET NULL on delete (they are soft-deleted in practice);
-- a deleted office takes its inquiries with it. PII is scrubbed by the inquiries retention job.

-- CreateEnum
CREATE TYPE "inquiry_channel" AS ENUM ('MESSAGE', 'CALL', 'SMS', 'COPY');

-- CreateEnum
CREATE TYPE "inquiry_status" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "inquiry_source" AS ENUM ('MAIN', 'SITE');

-- CreateEnum
CREATE TYPE "inquiry_author" AS ENUM ('CUSTOMER', 'AGENCY');

-- CreateTable
CREATE TABLE "inquiries" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "listing_id" UUID,
    "user_id" UUID,
    "channel" "inquiry_channel" NOT NULL,
    "status" "inquiry_status" NOT NULL DEFAULT 'NEW',
    "source" "inquiry_source" NOT NULL,
    "customer_name" VARCHAR(30),
    "customer_phone" VARCHAR(20),
    "message" TEXT,
    "memo" VARCHAR(1000),
    "handled_by_user_id" UUID,
    "read_at" TIMESTAMPTZ(3),
    "customer_read_at" TIMESTAMPTZ(3),
    "last_message_at" TIMESTAMPTZ(3) NOT NULL,
    "consent_terms_document_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "visitor_hash" VARCHAR(64),
    "pii_scrubbed_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "delete_reason" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_messages" (
    "id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "author" "inquiry_author" NOT NULL,
    "body" TEXT NOT NULL,
    "author_user_id" UUID,
    "author_name" VARCHAR(50),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inquiries_agency_id_deleted_at_last_message_at_idx" ON "inquiries"("agency_id", "deleted_at", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "inquiries_agency_id_read_at_idx" ON "inquiries"("agency_id", "read_at");

-- CreateIndex
CREATE INDEX "inquiries_user_id_created_at_idx" ON "inquiries"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "inquiries_last_message_at_idx" ON "inquiries"("last_message_at");

-- CreateIndex
CREATE INDEX "inquiries_listing_id_idx" ON "inquiries"("listing_id");

-- CreateIndex
CREATE INDEX "inquiries_handled_by_user_id_idx" ON "inquiries"("handled_by_user_id");

-- CreateIndex
CREATE INDEX "inquiry_messages_inquiry_id_created_at_idx" ON "inquiry_messages"("inquiry_id", "created_at");

-- CreateIndex
CREATE INDEX "inquiry_messages_author_user_id_idx" ON "inquiry_messages"("author_user_id");

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_handled_by_user_id_fkey" FOREIGN KEY ("handled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_messages" ADD CONSTRAINT "inquiry_messages_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_messages" ADD CONSTRAINT "inquiry_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
