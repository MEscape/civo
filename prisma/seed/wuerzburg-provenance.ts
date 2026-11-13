import { toJsonValue } from '@lib/db';
import type { Transaction } from '@lib/db';
import { stableStringify } from '@lib/utils';

import type { WuerzburgManifest } from './wuerzburg-manifest';

const MAX_RECORDS = 1_000;

/** Database sidecar evidence for seed-owned application records whose existing tables have no provenance column. */
export async function seedWuerzburgProvenance(
  tx: Transaction,
  {
    manifest,
    hasAuthAccounts,
  }: { readonly manifest: WuerzburgManifest; readonly hasAuthAccounts: boolean },
): Promise<void> {
  const websiteId = manifest.websiteId;
  const ledgerId = `${websiteId}-provenance`;
  const [
    pages,
    configs,
    sources,
    datasets,
    locations,
    resources,
    services,
    bookings,
    assignments,
    serviceLocations,
    releases,
  ] = await Promise.all([
    tx.orm.public.Page.where({ websiteId }).select('id', 'version').limit(MAX_RECORDS).all(),
    tx.orm.public.PageConfig.where((row) => row.page.some({ websiteId }))
      .select('id')
      .limit(MAX_RECORDS)
      .all(),
    tx.orm.public.DataSource.where({ websiteId }).select('id').limit(MAX_RECORDS).all(),
    tx.orm.public.Dataset.where((row) => row.dataSource.some({ websiteId }))
      .select('id')
      .limit(MAX_RECORDS)
      .all(),
    tx.orm.public.BookingLocation.where({ websiteId }).select('id').limit(MAX_RECORDS).all(),
    tx.orm.public.BookableResource.where({ websiteId }).select('id').limit(MAX_RECORDS).all(),
    tx.orm.public.BookableService.where({ websiteId }).select('id').limit(MAX_RECORDS).all(),
    tx.orm.public.Booking.where({ websiteId }).select('id').limit(MAX_RECORDS).all(),
    tx.orm.public.BookingAssignment.where({ websiteId })
      .select('bookingId', 'requirementIndex', 'unitIndex')
      .limit(MAX_RECORDS)
      .all(),
    tx.orm.public.BookableServiceLocation.where({ websiteId })
      .select('serviceId', 'locationId')
      .limit(MAX_RECORDS)
      .all(),
    tx.orm.public.WebsiteRelease.where({ websiteId }).select('id').limit(MAX_RECORDS).all(),
  ]);
  const evidence = {
    kind: 'synthetic',
    sourceId: 'wuerzburg-seed-manifest',
    sourceUrl: null,
    fetchedAt: manifest.epoch,
    validUntil: null,
    license: null,
    licenseUrl: null,
    attribution: null,
  };
  const ownsId = (id: string) => id.startsWith(`${websiteId}-`);
  const sourceIds = new Set<string>(manifest.sources.map((source) => source.id));
  const datasetIds = new Set<string>(manifest.datasets.map((dataset) => dataset.id));
  const records = [
    { recordType: 'Website', recordId: websiteId },
    { recordType: 'WebsiteTheme', recordId: `${websiteId}-theme` },
    ...pages
      .filter((row) => ownsId(row.id))
      .map((page) => ({ recordType: 'Page', recordId: page.id })),
    ...configs
      .filter((row) => ownsId(row.id))
      .map((row) => ({ recordType: 'PageConfig', recordId: row.id })),
    { recordType: 'DataSource', recordId: ledgerId },
    ...sources
      .filter((row) => sourceIds.has(row.id))
      .map((row) => ({ recordType: 'DataSource', recordId: row.id })),
    ...datasets
      .filter((row) => datasetIds.has(row.id))
      .map((row) => ({ recordType: 'Dataset', recordId: row.id })),
    ...locations
      .filter((row) => ownsId(row.id))
      .map((row) => ({ recordType: 'BookingLocation', recordId: row.id })),
    ...resources
      .filter((row) => ownsId(row.id))
      .map((row) => ({ recordType: 'BookableResource', recordId: row.id })),
    ...services
      .filter((row) => ownsId(row.id))
      .map((row) => ({ recordType: 'BookableService', recordId: row.id })),
    ...bookings
      .filter((row) => ownsId(row.id))
      .map((row) => ({ recordType: 'Booking', recordId: row.id })),
    ...assignments
      .filter((row) => ownsId(row.bookingId))
      .map((row) => ({
        recordType: 'BookingAssignment',
        recordId: stableStringify(row),
      })),
    ...serviceLocations
      .filter((row) => ownsId(row.serviceId) && ownsId(row.locationId))
      .map((row) => ({
        recordType: 'BookableServiceLocation',
        recordId: stableStringify(row),
      })),
    ...releases
      .filter((row) => ownsId(row.id))
      .map((row) => ({ recordType: 'WebsiteRelease', recordId: row.id })),
    ...manifest.accounts.flatMap((account) => [
      { recordType: 'Membership', recordId: `${account.id}-membership` },
      ...(hasAuthAccounts
        ? [
            { recordType: 'AuthUser', recordId: account.id },
            { recordType: 'AuthAccount', recordId: `${account.id}-credential` },
          ]
        : []),
    ]),
  ]
    .map((record) => ({
      id: `${record.recordType}:${record.recordId}`,
      ...record,
      _provenance: evidence,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const id = ledgerId;
  const config = { schemaVersion: 1, records, provenance: evidence };
  const current = await tx.orm.public.DataSource.where({ id, websiteId }).select('config').first();
  if (current === null) {
    await tx.orm.public.DataSource.create({
      id,
      websiteId,
      name: 'Synthetisches Referenzmanifest: Datensatzherkunft',
      kind: 'MOCK',
      config: toJsonValue(config),
      status: 'OK',
    });
  } else if (stableStringify(current.config) !== stableStringify(config)) {
    await tx.orm.public.DataSource.where({ id, websiteId }).updateAndCount({
      config: toJsonValue(config),
    });
  }
}
