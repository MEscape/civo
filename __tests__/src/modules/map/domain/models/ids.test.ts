import { describe, expect, it } from 'vitest';

import { parseDatasetId, parseMapId, parseWebsiteId } from '@modules/map/domain/models/ids';
import {
  mapOptionsSchema,
  savedMapSettingsSchema,
} from '@modules/map/presentation/schemas/saved-map-schema';

import { mapDraft } from '../../support/map-fakes';

describe('map references preserve other modules opaque identities', () => {
  it.each(['reference-city-wuerzburg', '00000000-0000-4000-8000-000000000001', 'x'.repeat(128)])(
    'accepts a supported website identity: %s',
    (id) => {
      expect(parseWebsiteId(id).isOk()).toBe(true);
      expect(mapOptionsSchema.safeParse({ websiteId: id }).success).toBe(true);
    },
  );
  it('accepts a reference dataset binding at the domain and action boundary', () => {
    const id = 'wuerzburg-dataset-gauge-locations';
    expect(parseDatasetId(id).isOk()).toBe(true);
    expect(
      savedMapSettingsSchema.safeParse(
        mapDraft({ layers: [{ datasetId: id, label: 'Main' }] }).settings,
      ).success,
    ).toBe(true);
  });
  it.each(['', 'x'.repeat(129)])('rejects empty or oversized external identities', (id) => {
    expect(parseWebsiteId(id).isErr()).toBe(true);
    expect(parseDatasetId(id).isErr()).toBe(true);
    expect(mapOptionsSchema.safeParse({ websiteId: id }).success).toBe(false);
  });
  it('keeps the map module own identity contract unchanged', () => {
    expect(parseMapId('not-a-map-uuid').isErr()).toBe(true);
    expect(parseMapId('00000000-0000-4000-8000-000000000003').isOk()).toBe(true);
  });
});
