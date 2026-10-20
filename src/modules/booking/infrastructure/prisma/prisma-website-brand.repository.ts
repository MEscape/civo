import { createPersistenceFailures, db } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_ERROR_CODES } from '../../domain/errors/booking-errors';

import { WEBSITE_BRAND_SELECT, toWebsiteTheme } from './website-brand-record-mapper';

import type { WebsiteId } from '../../domain/models/ids';
import type {
  WebsiteBrandRepository,
  WebsiteTheme,
} from '../../domain/ports/website-brand.repository';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: BOOKING_ERROR_CODES.persistenceFailed,
  subject: 'WebsiteTheme',
});

/** Reads a website's stored theme and its slug: all of a website a booking message uses. */
export class PrismaWebsiteBrandRepository implements WebsiteBrandRepository {
  findThemeOf(websiteId: WebsiteId): AppResultAsync<WebsiteTheme | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.WebsiteTheme.where({ websiteId })
          .select(...WEBSITE_BRAND_SELECT)
          .first(),
      failures.infraOnly('findThemeOf'),
    ).map(toWebsiteTheme);
  }

  findSlugOf(websiteId: WebsiteId): AppResultAsync<string | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => db.orm.public.Website.where({ id: websiteId }).select('slug').first(),
      failures.infraOnly('findSlugOf'),
    ).map((record) => record?.slug ?? null);
  }
}
