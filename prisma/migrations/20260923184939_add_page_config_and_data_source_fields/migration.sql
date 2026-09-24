/*
  Warnings:

  - The values [GRAPHQL] on the enum `DataSourceKind` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "DataSourceStatus" AS ENUM ('UNKNOWN', 'OK', 'ERROR');

-- AlterEnum
BEGIN;
CREATE TYPE "DataSourceKind_new" AS ENUM ('MOCK', 'REST');
ALTER TABLE "DataSource" ALTER COLUMN "kind" TYPE "DataSourceKind_new" USING ("kind"::text::"DataSourceKind_new");
ALTER TYPE "DataSourceKind" RENAME TO "DataSourceKind_old";
ALTER TYPE "DataSourceKind_new" RENAME TO "DataSourceKind";
DROP TYPE "public"."DataSourceKind_old";
COMMIT;

-- DropIndex
DROP INDEX "DataSource_websiteId_name_key";

-- AlterTable
ALTER TABLE "DataSource" ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "status" "DataSourceStatus" NOT NULL DEFAULT 'UNKNOWN';

-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "canonicalType" TEXT NOT NULL,
    "mapping" JSONB,
    "status" "DataSourceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_dataSourceId_slug_key" ON "Dataset"("dataSourceId", "slug");

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
