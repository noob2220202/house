-- auth: withdrawal_cooldown_age_confirmation
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "age_confirmed_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "withdrawn_identities" (
    "id" UUID NOT NULL,
    "provider" "auth_provider" NOT NULL,
    "provider_user_id_hash" CHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "withdrawn_at" TIMESTAMPTZ(3) NOT NULL,
    "rejoin_after" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "withdrawn_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "withdrawn_identities_rejoin_after_idx" ON "withdrawn_identities"("rejoin_after");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawn_identities_provider_provider_user_id_hash_key" ON "withdrawn_identities"("provider", "provider_user_id_hash");
