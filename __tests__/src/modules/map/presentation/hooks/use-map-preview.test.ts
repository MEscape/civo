import { describe, expect, it, vi } from 'vitest';

import { previewDraftOf } from '@modules/map/presentation/hooks/use-map-preview';
import { savedMapDraftSchema } from '@modules/map/presentation/schemas/saved-map-schema';

import { mapDraft } from '../../support/map-fakes';

vi.mock('@modules/map/presentation/actions/preview-map-window-action', () => ({
  previewMapWindowAction: vi.fn(),
}));

describe('previewDraftOf', () => {
  const valid = savedMapDraftSchema.parse(mapDraft());

  it('draws only the settings, under the name it is given, so typing a name or description draws nothing new', () => {
    const first = previewDraftOf({ ...valid, name: 'One', description: 'a' }, 'Preview');
    const second = previewDraftOf({ ...valid, name: 'Two', description: 'b' }, 'Preview');
    expect(first).toEqual({ name: 'Preview', description: null, settings: valid.settings });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('draws nothing while the settings are not a valid map yet', () => {
    expect(
      previewDraftOf({ ...valid, settings: { ...valid.settings, layers: [], locations: [] } }, 'P'),
    ).toBeNull();
    expect(
      previewDraftOf(
        { ...valid, settings: { ...valid.settings, initialBounds: [10, 50, 9, 49] } },
        'P',
      ),
    ).toBeNull();
  });
});
