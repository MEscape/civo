import type { AppResultAsync } from '@lib/result';

import { createWebsiteTheme } from '../../domain/models/website-theme';
import { WEBSITE_RATE_LIMITS } from '../rate-limits';
import { findWebsite } from '../services/find-website';
import { withinActorLimit } from '../services/within-actor-limit';
import { toWebsiteView } from '../website-view-mappers';

import type { UpdateWebsiteThemeInput, WebsiteView } from '../contracts/website-views';
import type { ExistingWebsiteDependencies, WebsiteMutationError } from '../website-dependencies';

/**
 * Replaces a website's theme. The theme is addressed through its website
 * (never by a client-supplied theme id), so authorization always covers
 * the resource that is actually changed.
 */
export class UpdateWebsiteTheme {
  constructor(private readonly deps: ExistingWebsiteDependencies) {}

  execute(input: UpdateWebsiteThemeInput): AppResultAsync<WebsiteView, WebsiteMutationError> {
    const { websites, audit } = this.deps;

    return this.deps.access
      .authorizeWebsite('theme.update', input.websiteId)
      .andThen(withinActorLimit(this.deps, WEBSITE_RATE_LIMITS.updateTheme, (scope) => scope))
      .andThen((scope) =>
        findWebsite(websites, scope).andThen((website) =>
          createWebsiteTheme(input.theme)
            .asyncAndThen((theme) => websites.updateTheme(website.id, scope.tenantId, theme))
            .map((updated) => {
              audit.record({
                type: 'website.theme_updated',
                actorId: scope.actorId,
                tenantId: scope.tenantId,
                websiteId: updated.id,
              });
              return toWebsiteView(updated);
            }),
        ),
      );
  }
}
