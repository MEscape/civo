/*
  Warnings:

  - A unique constraint covering the columns `[publishedReleaseId]` on the table `Website` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "MigrationStatus" AS ENUM ('PROPOSED', 'APPLIED');

-- AlterTable
ALTER TABLE "Website" ADD COLUMN     "publishedReleaseId" TEXT;

-- CreateTable
CREATE TABLE "WebsiteRelease" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "releaseNumber" INTEGER NOT NULL,
    "status" "ReleaseStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshot" JSONB NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "WebsiteRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Migration" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "sourceReleaseId" TEXT NOT NULL,
    "status" "MigrationStatus" NOT NULL DEFAULT 'PROPOSED',
    "planSnapshot" JSONB NOT NULL,
    "resolutions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "Migration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteRelease_websiteId_releaseNumber_key" ON "WebsiteRelease"("websiteId", "releaseNumber");

-- CreateIndex
CREATE INDEX "Migration_websiteId_idx" ON "Migration"("websiteId");

-- CreateIndex
CREATE UNIQUE INDEX "Website_publishedReleaseId_key" ON "Website"("publishedReleaseId");

-- AddForeignKey
ALTER TABLE "Website" ADD CONSTRAINT "Website_publishedReleaseId_fkey" FOREIGN KEY ("publishedReleaseId") REFERENCES "WebsiteRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteRelease" ADD CONSTRAINT "WebsiteRelease_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Migration" ADD CONSTRAINT "Migration_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Migration" ADD CONSTRAINT "Migration_sourceReleaseId_fkey" FOREIGN KEY ("sourceReleaseId") REFERENCES "WebsiteRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
