import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { websiteNotFound } from '../../domain/errors/website-errors';
import { isValidSlug } from '../../domain/models/website';
import { toPublicWebsiteView } from '../website-view-mappers';

import type { Website } from '../../domain/models/website';
import type { PublicWebsiteView } from '../contracts/website-views';
import type { PublicWebsiteDependencies } from '../website-dependencies';

/**
 * Serves the public site, so it is intentionally unauthenticated: every
 * website is public by slug, as before. That is also why it returns the
 * narrow `PublicWebsiteView` and never the owner's view. If drafts or
 * unpublished sites are introduced, the visibility check belongs here.
 *
 * @authorization public Serves the public site; every website is public by its slug.
 */
export class GetPublicWebsiteBySlug {
  constructor(private readonly deps: PublicWebsiteDependencies) {}

  execute(
    slug: string,
  ): AppResultAsync<PublicWebsiteView, NotFoundAppError | InfrastructureAppError> {
    if (!isValidSlug(slug)) {
      return errAsync(websiteNotFound());
    }

    return this.deps.websites
      .findBySlug(slug)
      .andThen((website): AppResultAsync<Website, NotFoundAppError> =>
        website === null ? errAsync(websiteNotFound()) : okAsync(website),
      )
      .map(toPublicWebsiteView);
  }
}
