import type { AppResult } from '@lib/result';

import type { WebsiteId } from '../models/ids';
import type { SavedMapDraft } from '../models/saved-map';

/** Longest signed configuration a browser may send back; anything longer is rejected before it is verified. */
export const MAX_INLINE_MAP_TOKEN_LENGTH = 128_000;

export interface InlineMapDefinition {
  readonly websiteId: WebsiteId;
  readonly mode: 'draft' | 'published';
  readonly draft: SavedMapDraft;
}

/** A browser may move a server-rendered map, but cannot replace its website, datasets or preview mode. */
export interface InlineMapToken {
  issue(definition: InlineMapDefinition): AppResult<string>;
  read(token: string): AppResult<InlineMapDefinition>;
}
