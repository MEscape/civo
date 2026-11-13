import { createHash } from 'node:crypto';

import { advisoryLock, dateToInstant, toJsonValue } from '../../src/lib/db';
import { stableStringify } from '../../src/lib/utils';
import { COMPONENT_DEFINITIONS } from '../../src/modules/component-platform/domain/components/component-definitions';

import { seedWuerzburgBookings } from './wuerzburg-bookings';
import { seedWuerzburgProvenance } from './wuerzburg-provenance';

import type { WuerzburgManifest } from './wuerzburg-manifest';
import type { Transaction } from '../../src/lib/db';

const RELEASE_HASH_ID_LENGTH = 16;

async function seedSources(tx: Transaction, manifest: WuerzburgManifest): Promise<void> {
  for (const source of manifest.sources) {
    const existing = await tx.orm.public.DataSource.where({
      id: source.id,
      websiteId: manifest.websiteId,
    })
      .select('id', 'config')
      .first();
    if (existing === null) {
      await tx.orm.public.DataSource.create({
        id: source.id,
        websiteId: manifest.websiteId,
        name: source.name,
        kind: 'MOCK',
        config: toJsonValue(source.config),
        status: 'OK',
      });
    } else if (stableStringify(existing.config) !== stableStringify(source.config)) {
      await tx.orm.public.DataSource.where({
        id: source.id,
        websiteId: manifest.websiteId,
      }).updateAndCount({ config: toJsonValue(source.config) });
    }
  }
  for (const dataset of manifest.datasets) {
    const existing = await tx.orm.public.Dataset.where({
      id: dataset.id,
      dataSourceId: dataset.sourceId,
    })
      .select('id', 'mapping')
      .first();
    if (existing === null) {
      await tx.orm.public.Dataset.create({
        id: dataset.id,
        dataSourceId: dataset.sourceId,
        name: dataset.name,
        slug: dataset.slug,
        canonicalKind: dataset.canonicalKind,
        path: null,
        mapping: toJsonValue(dataset.mapping),
        status: 'OK',
        lastFetchedAt: dateToInstant(new Date(manifest.epoch)),
      });
    } else if (stableStringify(existing.mapping) !== stableStringify(dataset.mapping)) {
      await tx.orm.public.Dataset.where({
        id: dataset.id,
        dataSourceId: dataset.sourceId,
      }).updateAndCount({ mapping: toJsonValue(dataset.mapping) });
    }
  }
}

async function seedPages(tx: Transaction, manifest: WuerzburgManifest): Promise<void> {
  for (const page of manifest.pages) {
    const pathHash = createHash('sha256')
      .update(page.path)
      .digest('hex')
      .slice(0, RELEASE_HASH_ID_LENGTH);
    const id = `${manifest.websiteId}-page-${pathHash}`;
    const existing = await tx.orm.public.Page.where({
      path: page.path,
      websiteId: manifest.websiteId,
    })
      .select('id', 'version', 'title')
      .first();
    if (existing === null) {
      await tx.orm.public.Page.create({
        id,
        tenantId: manifest.websiteId,
        websiteId: manifest.websiteId,
        path: page.path,
        title: page.title,
        version: 1,
      });
      await tx.orm.public.PageConfig.create({
        id: `${id}-config-1`,
        pageId: id,
        content: toJsonValue(page.config),
        status: 'DRAFT',
        version: 1,
      });
    } else {
      if (!existing.id.startsWith(`${manifest.websiteId}-page-`)) {
        throw new Error('Reference page path belongs to a non-seed record; seed refused');
      }
      const current = await tx.orm.public.PageConfig.where({
        pageId: existing.id,
        version: existing.version,
      })
        .select('content')
        .first();
      if (current === null || stableStringify(current.content) !== stableStringify(page.config)) {
        const version = existing.version + 1;
        const changed = await tx.orm.public.Page.where({
          id: existing.id,
          websiteId: manifest.websiteId,
          version: existing.version,
        }).updateAndCount({ version, title: page.title });
        if (changed !== 1) {
          throw new Error('Reference page changed concurrently; seed refused');
        }
        await tx.orm.public.PageConfig.create({
          id: `${existing.id}-config-${version}`,
          pageId: existing.id,
          content: toJsonValue(page.config),
          status: 'DRAFT',
          version,
        });
      } else if (existing.title !== page.title) {
        await tx.orm.public.Page.where({
          id: existing.id,
          websiteId: manifest.websiteId,
          version: existing.version,
        }).updateAndCount({ title: page.title });
      }
    }
  }
}

async function seedMemberships(tx: Transaction, manifest: WuerzburgManifest): Promise<void> {
  for (const account of manifest.accounts) {
    const tenantId = account.role === 'platform_admin' ? 'platform' : manifest.websiteId;
    const role = account.role;
    if (
      role !== 'platform_admin' &&
      role !== 'admin' &&
      role !== 'editor' &&
      role !== 'contributor' &&
      role !== 'viewer' &&
      role !== 'employee'
    ) {
      throw new Error('Reference manifest contains an unsupported role');
    }
    const existing = await tx.orm.public.Membership.where({ actorId: account.id, tenantId, role })
      .select('id')
      .first();
    if (existing === null) {
      await tx.orm.public.Membership.create({
        id: `${account.id}-membership`,
        actorId: account.id,
        tenantId,
        role,
      });
    }
  }
}

async function publishReference(tx: Transaction, manifest: WuerzburgManifest): Promise<void> {
  const snapshot = {
    schemaVersion: 2,
    website: {
      id: manifest.websiteId,
      name: manifest.website.name,
      slug: manifest.website.slug,
      description: manifest.website.description,
    },
    theme: manifest.theme,
    pages: manifest.pages
      .filter((page) => page.path !== 'component-lab')
      .map(({ path, title, config }) => ({ path, title, config })),
    maps: [],
    dependencies: COMPONENT_DEFINITIONS.map((definition) => ({
      type: definition.type,
      version: definition.version,
      contracts: definition.dependsOnContracts.map(({ contract, minVersion }) => ({
        contract,
        minVersion,
      })),
    })),
  };
  const hash = createHash('sha256').update(stableStringify(snapshot)).digest('hex');
  const latest = await tx.orm.public.WebsiteRelease.where({ websiteId: manifest.websiteId })
    .orderBy([(release) => release.releaseNumber.desc()])
    .select('id', 'releaseNumber', 'snapshotHash')
    .first();
  if (latest?.snapshotHash === hash) {
    return;
  }
  const id = `${manifest.websiteId}-release-${hash.slice(0, RELEASE_HASH_ID_LENGTH)}`;
  await tx.orm.public.WebsiteRelease.create({
    id,
    websiteId: manifest.websiteId,
    releaseNumber: (latest?.releaseNumber ?? 0) + 1,
    status: 'PUBLISHED',
    snapshot: toJsonValue(snapshot),
    snapshotHash: hash,
    note: 'Bürgerservice und Stadtdaten mit dokumentierten Quellen und datierten Momentaufnahmen',
    publishedAt: dateToInstant(new Date(manifest.epoch)),
    publishedBy: 'wuerzburg-demo-platform_admin',
  });
  await tx.orm.public.Website.where({
    id: manifest.websiteId,
    tenantId: manifest.websiteId,
  }).updateAndCount({ publishedReleaseId: id });
}

/** All application writes use one locked transaction; other websites are never selected for writes. */
export async function seedWuerzburgInTransaction(
  tx: Transaction,
  manifest: WuerzburgManifest,
  options: { readonly hasAuthAccounts: boolean },
): Promise<void> {
  await advisoryLock(tx, 'seed:wuerzburg');
  const conflicting = await tx.orm.public.Website.where({ slug: manifest.website.slug })
    .select('id')
    .first();
  if (conflicting !== null && conflicting.id !== manifest.websiteId) {
    throw new Error('The wuerzburg slug belongs to an existing website; seed refused');
  }
  const existing = await tx.orm.public.Website.where({
    id: manifest.websiteId,
    tenantId: manifest.websiteId,
  })
    .select('id', 'name', 'description')
    .first();
  if (existing === null) {
    await tx.orm.public.Website.create({
      id: manifest.websiteId,
      tenantId: manifest.websiteId,
      ...manifest.website,
    });
    await tx.orm.public.WebsiteTheme.create({
      id: `${manifest.websiteId}-theme`,
      websiteId: manifest.websiteId,
      ...manifest.theme,
    });
  } else if (
    existing.name !== manifest.website.name ||
    existing.description !== manifest.website.description
  ) {
    await tx.orm.public.Website.where({
      id: manifest.websiteId,
      tenantId: manifest.websiteId,
    }).updateAndCount({ name: manifest.website.name, description: manifest.website.description });
  }
  await seedSources(tx, manifest);
  await seedPages(tx, manifest);
  await seedMemberships(tx, manifest);
  await seedWuerzburgBookings(tx, manifest.websiteId, new Date(manifest.epoch));
  await publishReference(tx, manifest);
  await seedWuerzburgProvenance(tx, { manifest, hasAuthAccounts: options.hasAuthAccounts });
}
