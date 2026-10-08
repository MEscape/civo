import type { AppResultAsync } from '@lib/result';

import { createWebsiteTheme } from '../../domain/models/website-theme';
import { loadAuthorizedWebsite } from '../load-authorized-website';
import { toWebsiteView } from '../website-view-mappers';

import type { UpdateWebsiteThemeInput, WebsiteView } from '../contracts/website-views';
import type { LoadWebsiteError } from '../load-authorized-website';
import type { WebsiteDependencies } from '../website-dependencies';

/**
 * Replaces a website's theme. The theme is addressed through its website
 * (never by a client-supplied theme id), so authorization always covers
 * the resource that is actually changed.
 */
export class UpdateWebsiteTheme {
  constructor(private readonly deps: WebsiteDependencies) {}

  execute(input: UpdateWebsiteThemeInput): AppResultAsync<WebsiteView, LoadWebsiteError> {
    const { websites, audit } = this.deps;

    return loadAuthorizedWebsite(this.deps, input.websiteId, 'theme.update').andThen(
      ({ actor, website }) =>
        createWebsiteTheme(input.theme)
          .asyncAndThen((theme) => websites.updateTheme(website.id, actor.tenantId, theme))
          .map((updated) => {
            audit.record({
              type: 'website.theme_updated',
              actorId: actor.id,
              tenantId: actor.tenantId,
              websiteId: updated.id,
            });
            return toWebsiteView(updated);
          }),
    );
  }
}
