import 'dotenv/config';
import '../lib/server-runtime';

import { readWuerzburgManifest } from '../../prisma/seed/wuerzburg-manifest';
import { advisoryLock, dateToInstant, db, disconnectDb, toJsonValue } from '../../src/lib/db';
import { stableStringify } from '../../src/lib/utils';
import { readSnapshotSourceConfig } from '../../src/modules/data-sources/domain/config/snapshot-source-config';

/** Trusted operator CLI: updates only existing city snapshot sources, never pages, accounts or bookings. */
const manifest = await readWuerzburgManifest();
try {
  const changed = await db.transaction(async (tx) => {
    await advisoryLock(tx, 'seed:wuerzburg');
    let count = 0;
    for (const source of manifest.sources) {
      const existing = await tx.orm.public.DataSource.where({
        id: source.id,
        websiteId: manifest.websiteId,
      })
        .select('id', 'kind', 'config')
        .first();
      if (existing?.kind !== 'MOCK') {
        throw new Error('Ingestion requires an existing configured city snapshot source');
      }
      const previous = readSnapshotSourceConfig(existing.config);
      const incoming = readSnapshotSourceConfig(source.config);
      if (
        previous === null ||
        incoming === null ||
        previous.provenance.kind !== 'snapshot' ||
        incoming.provenance.kind !== 'snapshot' ||
        previous.provenance.sourceId !== incoming.provenance.sourceId
      ) {
        throw new Error('Source ownership or provenance changed; ingestion refused');
      }
      if (stableStringify(existing.config) === stableStringify(source.config)) {
        continue;
      }
      await tx.orm.public.DataSource.where({
        id: source.id,
        websiteId: manifest.websiteId,
      }).updateAndCount({ config: toJsonValue(source.config), status: 'OK' });
      await tx.orm.public.Dataset.where({ dataSourceId: source.id }).updateAndCount({
        lastFetchedAt: dateToInstant(new Date(incoming.provenance.fetchedAt)),
      });
      count += 1;
    }
    return count;
  });
  process.stdout.write(
    `Updated ${changed} existing civic snapshot sources. No pages, users or bookings changed.\n`,
  );
} finally {
  await disconnectDb();
}
