import type { TenantId } from '@modules/auth';

import { createPersistenceFailures, db } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_ERROR_CODES } from '../../domain/errors/booking-errors';

import { WEBSITE_OWNER_SELECT, toWebsiteOwner } from './website-directory-record-mapper';

import type { WebsiteId } from '../../domain/models/ids';
import type { WebsiteDirectoryRepository } from '../../domain/ports/website-directory.repository';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: BOOKING_ERROR_CODES.persistenceFailed,
  subject: 'Website',
});

/**
 * Reads the owner of a website from its stored record. The public flow has no signed-in actor: the
 * tenant that scopes every later query comes from here, never from the request.
 */
export class PrismaWebsiteDirectoryRepository implements WebsiteDirectoryRepository {
  findTenantOf(websiteId: WebsiteId): AppResultAsync<TenantId | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Website.where({ id: websiteId })
          .where((website) => website.publishedReleaseId.isNotNull())
          .select(...WEBSITE_OWNER_SELECT)
          .first(),
      failures.infraOnly('findTenantOf'),
    ).map(toWebsiteOwner);
  }
}

/** The one instance the composition root wires (the adapter holds no state). */
export const prismaWebsiteDirectoryRepository = new PrismaWebsiteDirectoryRepository();
