import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { MAX_WEBSITE_OPTIONS } from '../list-limits';

import type { WebsiteId } from '../../domain/models/ids';
import type { WebsiteDependencies } from '../website-dependencies';

export interface WebsiteOptionsView {
  readonly websites: ReadonlyArray<{ readonly id: WebsiteId; readonly name: string }>;
  /** More websites exist than are offered: the screen says so rather than leave some out unseen. */
  readonly isTruncated: boolean;
}

/**
 * Every website of the platform by name, to choose one in a filter or to
 * name where people work: ids and names only. For the platform's
 * administrators, who may list them all.
 */
export class ListWebsiteOptions {
  constructor(private readonly deps: WebsiteDependencies) {}

  execute(): AppResultAsync<WebsiteOptionsView, AuthorizationError | InfrastructureAppError> {
    return this.deps.authorization
      .requireInTenant('website.list.all')
      .andThen(() => this.deps.websites.listOptions(MAX_WEBSITE_OPTIONS))
      .map(({ items, isTruncated }) => ({ websites: items, isTruncated }));
  }
}
