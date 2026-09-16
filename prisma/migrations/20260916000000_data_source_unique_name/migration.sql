-- CreateIndex
-- One row per (website, name) — e.g. a website has at most one row named
-- "civic-primary". Required by dataSourceRepository.upsert, which relies
-- on this constraint to update the existing configured source for a
-- dataset instead of creating a duplicate on every save.
CREATE UNIQUE INDEX "DataSource_websiteId_name_key" ON "DataSource"("websiteId", "name");
