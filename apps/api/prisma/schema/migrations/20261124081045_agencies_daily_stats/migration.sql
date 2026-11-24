-- CreateTable
CREATE TABLE "agency_daily_stats" (
    "agency_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "listing_views" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agency_daily_stats_pkey" PRIMARY KEY ("agency_id","day")
);

-- AddForeignKey
ALTER TABLE "agency_daily_stats" ADD CONSTRAINT "agency_daily_stats_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
