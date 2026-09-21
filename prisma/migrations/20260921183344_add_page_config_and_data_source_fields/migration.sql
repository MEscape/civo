/*
  Warnings:

  - A unique constraint covering the columns `[websiteId,dataset]` on the table `DataSource` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `dataset` to the `DataSource` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DataSourceDataset" AS ENUM ('civic', 'smartcity');

-- CreateEnum
CREATE TYPE "DataSourceStatus" AS ENUM ('UNKNOWN', 'OK', 'ERROR');

-- DropIndex
DROP INDEX "DataSource_websiteId_name_key";

-- AlterTable
ALTER TABLE "DataSource" ADD COLUMN     "dataset" "DataSourceDataset" NOT NULL,
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "mapping" JSONB,
ADD COLUMN     "status" "DataSourceStatus" NOT NULL DEFAULT 'UNKNOWN';

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_websiteId_dataset_key" ON "DataSource"("websiteId", "dataset");
