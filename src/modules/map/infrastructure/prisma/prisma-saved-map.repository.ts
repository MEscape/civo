import type { Clock } from '@lib/clock';
import { advisoryLock, createPersistenceFailures, dateToInstant, db, toJsonValue } from '@lib/db';
import { offsetOf, toPage } from '@lib/pagination';
import type { PageRequest } from '@lib/pagination';
import { combine, err, fromThrowableAsync, ok } from '@lib/result';

import { mapLimitReached, mapVersionConflict } from '../../domain/errors/map-errors';
import { SAVED_MAP_LIMITS } from '../../domain/models/saved-map';

import { SAVED_MAP_SELECT, toSavedMap } from './saved-map-record-mapper';

import type { MapId, WebsiteId } from '../../domain/models/ids';
import type { SavedMapDraft } from '../../domain/models/saved-map';
import type { SavedMapRepository } from '../../domain/ports/saved-map.repository';

const failures = createPersistenceFailures({
  module: 'map.persistence',
  code: 'map.persistence_failed',
  subject: 'Map',
});

/** Every query includes websiteId. The create lock serializes the cap; updates use a single conditional write. */
export class PrismaSavedMapRepository implements SavedMapRepository {
  constructor(private readonly clock: Clock) {}

  list(websiteId: WebsiteId, page: PageRequest) {
    return fromThrowableAsync(async () => {
      const [count, records] = await Promise.all([
        db.orm.public.SavedMap.where({ websiteId }).aggregate((a) => ({ total: a.count() })),
        db.orm.public.SavedMap.where({ websiteId })
          .select(...SAVED_MAP_SELECT)
          .orderBy([(map) => map.name.asc(), (map) => map.id.asc()])
          .limit(page.pageSize)
          .offset(offsetOf(page))
          .all(),
      ]);
      return { count, records };
    }, failures.infraOnly('list')).andThen(({ count, records }) =>
      combine(records.map(toSavedMap)).map((maps) => toPage(maps, count.total, page)),
    );
  }

  findById(websiteId: WebsiteId, id: MapId) {
    return fromThrowableAsync(
      async () =>
        db.orm.public.SavedMap.where({ websiteId, id })
          .select(...SAVED_MAP_SELECT)
          .first(),
      failures.infraOnly('findById'),
    ).andThen((record) => (record === null ? ok(null) : toSavedMap(record)));
  }

  create(websiteId: WebsiteId, draft: SavedMapDraft) {
    return fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          await advisoryLock(tx, `map:create:${websiteId}`);
          const count = await tx.orm.public.SavedMap.where({ websiteId }).aggregate((a) => ({
            total: a.count(),
          }));
          if (count.total >= SAVED_MAP_LIMITS.mapsPerWebsite) {
            return null;
          }
          return tx.orm.public.SavedMap.create({
            websiteId,
            name: draft.name,
            description: draft.description,
            settings: toJsonValue(draft.settings),
            updatedAt: dateToInstant(this.clock.now()),
          });
        }),
      failures.infraOnly('create'),
    ).andThen((record) => (record === null ? err(mapLimitReached()) : toSavedMap(record)));
  }

  delete(websiteId: WebsiteId, id: MapId) {
    return fromThrowableAsync(
      async () => (await db.orm.public.SavedMap.where({ websiteId, id }).deleteAndCount()) > 0,
      failures.infraOnly('delete'),
    );
  }

  update({
    websiteId,
    id,
    version,
    draft,
  }: {
    readonly websiteId: WebsiteId;
    readonly id: MapId;
    readonly version: number;
    readonly draft: SavedMapDraft;
  }) {
    return fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          const count = await tx.orm.public.SavedMap.where({
            websiteId,
            id,
            version,
          }).updateAndCount({
            name: draft.name,
            description: draft.description,
            settings: toJsonValue(draft.settings),
            version: version + 1,
            updatedAt: dateToInstant(this.clock.now()),
          });
          return count === 0
            ? null
            : tx.orm.public.SavedMap.where({ websiteId, id })
                .select(...SAVED_MAP_SELECT)
                .first();
        }),
      failures.infraOnly('update'),
    ).andThen((record) => (record === null ? err(mapVersionConflict()) : toSavedMap(record)));
  }
}
