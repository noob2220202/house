-- CreateEnum
CREATE TYPE "complex_data_source" AS ENUM ('ADMIN', 'TRADE_BOOTSTRAP');

-- AlterTable
ALTER TABLE "complex_area_types" ADD COLUMN     "source" "complex_data_source" NOT NULL DEFAULT 'ADMIN';

-- AlterTable
ALTER TABLE "complexes" ADD COLUMN     "source" "complex_data_source" NOT NULL DEFAULT 'ADMIN';
