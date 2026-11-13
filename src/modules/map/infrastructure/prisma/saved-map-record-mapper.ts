import type { InstantRecord } from '@lib/db';
import { instantToDate } from '@lib/db';
import { err, ok } from '@lib/result';

import { mapSourceFailed } from '../../domain/errors/map-errors';
import { toMapId, toWebsiteId } from '../../domain/models/ids';
import { isSavedMapSettings } from '../../domain/models/saved-map';

export const SAVED_MAP_SELECT = [
  'id',
  'websiteId',
  'name',
  'description',
  'settings',
  'version',
  'updatedAt',
] as const;

interface SavedMapRecord {
  readonly id: string;
  readonly websiteId: string;
  readonly name: string;
  readonly description: string | null;
  readonly settings: unknown;
  readonly version: number;
  readonly updatedAt: InstantRecord;
}

export function toSavedMap(record: SavedMapRecord) {
  return isSavedMapSettings(record.settings)
    ? ok({
        ...record,
        id: toMapId(record.id),
        websiteId: toWebsiteId(record.websiteId),
        settings: record.settings,
        updatedAt: instantToDate(record.updatedAt),
      })
    : err(mapSourceFailed());
}
