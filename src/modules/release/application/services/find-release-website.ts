import type { NotFoundAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { releaseWebsiteNotFound } from '../../domain/errors/release-errors';

import type { WebsiteId } from '../../domain/models/ids';
import type { WebsiteSource, WebsiteSourceError } from '../../domain/ports/website-source.port';
import type { PublishableWebsite } from '../../domain/publishing/publishable';

/** Reads publishable website details only after the use case has authorized its target. */
export function findReleaseWebsite(
  websites: WebsiteSource,
  websiteId: WebsiteId,
): AppResultAsync<PublishableWebsite, WebsiteSourceError | NotFoundAppError> {
  return websites
    .findById(websiteId)
    .andThen((website) =>
      website === null ? errAsync(releaseWebsiteNotFound()) : okAsync(website),
    );
}
