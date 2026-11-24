-- CreateTable
CREATE TABLE "admin_notifications" (
    "id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(1000),
    "link" VARCHAR(500),
    "dedupe_key" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_notification_reads" (
    "notification_id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_notification_reads_pkey" PRIMARY KEY ("notification_id","admin_user_id")
);

-- CreateTable
CREATE TABLE "admin_account_deletions" (
    "admin_user_id" UUID NOT NULL,
    "original_email" VARCHAR(254) NOT NULL,
    "deleted_by_admin_id" UUID,
    "deleted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_account_deletions_pkey" PRIMARY KEY ("admin_user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_notifications_dedupe_key_key" ON "admin_notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "admin_notifications_created_at_id_idx" ON "admin_notifications"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "admin_notification_reads_admin_user_id_notification_id_idx" ON "admin_notification_reads"("admin_user_id", "notification_id");

-- AddForeignKey
ALTER TABLE "admin_notification_reads" ADD CONSTRAINT "admin_notification_reads_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "admin_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
