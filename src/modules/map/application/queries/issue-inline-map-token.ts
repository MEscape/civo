import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parseWebsiteId } from '../../domain/models/ids';

import type { SavedMapDraft } from '../../domain/models/saved-map';
import type { MapOperationError, MapTokenDependencies } from '../map-dependencies';

/**
 * @rate-limit none Signing costs nothing and reveals nothing; the host that renders the map has already been through its own request limits, and the reader of the token is limited separately.
 * @authorization public Trusted server-rendered binding; the host authorized the configuration and the token limits the browser to that website, those datasets and that mode.
 */
export class IssueInlineMapToken {
  constructor(private readonly deps: MapTokenDependencies) {}

  execute(input: {
    readonly websiteId: string;
    readonly mode: 'draft' | 'published';
    readonly draft: SavedMapDraft;
  }): AppResultAsync<string, MapOperationError> {
    const issued = parseWebsiteId(input.websiteId).andThen((websiteId) =>
      this.deps.tokens.issue({ websiteId, mode: input.mode, draft: input.draft }),
    );
    return issued.isOk() ? okAsync(issued.value) : errAsync(issued.error);
  }
}
