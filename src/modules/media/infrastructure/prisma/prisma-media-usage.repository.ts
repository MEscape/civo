import type { TenantId } from '@modules/auth';

import { createPersistenceFailures, db } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { MEDIA_ERROR_CODES } from '../../domain/errors/media-errors';

import { isReferencedFrom } from './media-usage-record-mapper';

import type { MediaAssetId } from '../../domain/models/ids';
import type { MediaUsageRepository } from '../../domain/ports/media-usage.repository';

const failures = createPersistenceFailures({
  module: 'media.usage',
  code: MEDIA_ERROR_CODES.persistenceFailed,
  subject: 'Media usage',
});

/**
 * Looks for the asset's id in the content a website could still show:
 *
 *  - the NEWEST saved version of each of its pages (what the editor shows and what a publish
 *    would freeze; older versions are history), and
 *  - EVERY release snapshot, because a rollback restores any of them.
 *
 * The id is a UUID, so a text search for it cannot collide with other content. The columns are
 * `json`, not `jsonb`, hence the cast; a website's content is small and this runs only on delete.
 * It is a plain text search on purpose: it finds the id wherever a component puts it, so a new
 * prop that holds a file needs no change here.
 */
export class PrismaMediaUsageRepository implements MediaUsageRepository {
  isReferenced(
    tenantId: TenantId,
    assetId: MediaAssetId,
  ): AppResultAsync<boolean, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      const plan = db.raw.sql`
        SELECT (
          EXISTS (
            SELECT 1 FROM "PageConfig" config
            JOIN "Page" page ON page."id" = config."pageId"
            WHERE page."websiteId" = ${tenantId}
              AND config."version" = (
                SELECT max(latest."version") FROM "PageConfig" latest WHERE latest."pageId" = config."pageId"
              )
              AND position(${assetId} in config."content"::text) > 0
          )
          OR EXISTS (
            SELECT 1 FROM "WebsiteRelease" release
            WHERE release."websiteId" = ${tenantId}
              AND position(${assetId} in release."snapshot"::text) > 0
          )
        )::text AS referenced`
        .returnsRow({ referenced: { codecId: 'pg/text@1', nullable: false } })
        .build();
      // One row, always: the query selects a single boolean.
      for await (const row of db.runtime().query(plan)) {
        return isReferencedFrom(row);
      }
      return isReferencedFrom(undefined);
    }, failures.infraOnly('isReferenced'));
  }
}
