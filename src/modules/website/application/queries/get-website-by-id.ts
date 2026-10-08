import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedWebsite } from '../load-authorized-website';
import { toWebsiteView } from '../website-view-mappers';

import type { WebsiteView } from '../contracts/website-views';
import type { LoadWebsiteError } from '../load-authorized-website';
import type { WebsiteDependencies } from '../website-dependencies';

export class GetWebsiteById {
  constructor(private readonly deps: WebsiteDependencies) {}

  execute(id: string): AppResultAsync<WebsiteView, LoadWebsiteError> {
    return loadAuthorizedWebsite(this.deps, id, 'website.read').map(({ website }) =>
      toWebsiteView(website),
    );
  }
}
