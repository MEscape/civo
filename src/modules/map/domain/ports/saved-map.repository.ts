import type { InfrastructureAppError } from '@lib/errors';
import type { Page, PageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import type { MapId, WebsiteId } from '../models/ids';
import type { SavedMap, SavedMapDraft } from '../models/saved-map';

export interface SavedMapRepository {
  list(
    websiteId: WebsiteId,
    page: PageRequest,
  ): AppResultAsync<Page<SavedMap>, InfrastructureAppError>;
  findById(
    websiteId: WebsiteId,
    id: MapId,
  ): AppResultAsync<SavedMap | null, InfrastructureAppError>;
  create(websiteId: WebsiteId, draft: SavedMapDraft): AppResultAsync<SavedMap>;
  /** `false` when no such map existed. */
  delete(websiteId: WebsiteId, id: MapId): AppResultAsync<boolean>;
  update(input: {
    readonly websiteId: WebsiteId;
    readonly id: MapId;
    readonly version: number;
    readonly draft: SavedMapDraft;
  }): AppResultAsync<SavedMap>;
}
