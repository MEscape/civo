import type { AppResultAsync } from '@lib/result';

import { findWebsite } from '../services/find-website';
import { toWebsiteView } from '../website-view-mappers';

import type { WebsiteView } from '../contracts/website-views';
import type { ExistingWebsiteDependencies, WebsiteOperationError } from '../website-dependencies';

export class GetWebsiteById {
  constructor(private readonly deps: ExistingWebsiteDependencies) {}

  execute(id: string): AppResultAsync<WebsiteView, WebsiteOperationError> {
    return this.deps.access
      .authorizeWebsite('website.read', id)
      .andThen((scope) => findWebsite(this.deps.websites, scope))
      .map(toWebsiteView);
  }
}
