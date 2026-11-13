import { describe, expect, it } from 'vitest';

import { SaveMap } from '@modules/map/application/commands/save-map';
import { PreviewMapWindow } from '@modules/map/application/queries/preview-map-window';
import { ReadInlineMapWindow } from '@modules/map/application/queries/read-inline-map-window';
import { createSavedMapDraft } from '@modules/map/domain/models/saved-map';
import { HmacInlineMapToken } from '@modules/map/infrastructure/crypto/hmac-inline-map-token';
import { savedMapDraftSchema } from '@modules/map/presentation/schemas/saved-map-schema';

import { mapDraft, mapFakes, VIEWPORT, WEBSITE_ID, OTHER_WEBSITE_ID } from '../support/map-fakes';

const LOCATION = { id: 'town-hall', label: 'Town hall', longitude: 10, latitude: 51 };
const SECRET = 'a-map-signing-secret-with-at-least-32-characters';
const locationDraft = () => mapDraft({ layers: [], locations: [LOCATION] });

describe('Standalone location maps', () => {
  it('saves and previews a map without reading a geographic dataset', async () => {
    const fake = mapFakes();
    const draft = locationDraft();
    const saved = await new SaveMap(fake.dependencies).execute({ websiteId: WEBSITE_ID, ...draft });
    expect(saved.isOk()).toBe(true);
    const preview = await new PreviewMapWindow(fake.dependencies).execute({
      websiteId: WEBSITE_ID,
      draft,
      bounds: VIEWPORT,
    });
    expect(preview.isOk() && preview.value.featureCount).toBe(1);
    expect(fake.windows).toEqual([]);
    expect(fake.events).toContainEqual(expect.objectContaining({ type: 'map.created' }));
  });

  it('keeps manual locations in signed published windows and filters by viewport', async () => {
    const fake = mapFakes();
    const tokens = new HmacInlineMapToken(() => SECRET);
    const token = tokens.issue({
      websiteId: WEBSITE_ID,
      mode: 'published',
      draft: mapDraft({
        layers: [],
        locations: [LOCATION, { ...LOCATION, id: 'outside', longitude: 20 }],
      }),
    });
    expect(token.isOk()).toBe(true);
    if (token.isErr()) {
      return;
    }
    const result = await new ReadInlineMapWindow({ ...fake.dependencies, tokens }).execute({
      token: token.value,
      bounds: VIEWPORT,
    });
    expect(result.isOk() && result.value.featureCount).toBe(1);
    if (result.isOk()) {
      expect(result.value.layers[0]?.features[0]?.label).toBe('Town hall');
    }
    expect(fake.windows).toEqual([]);
  });

  it('shares the feature budget between manual locations and connected layers', async () => {
    const fake = mapFakes();
    const result = await new PreviewMapWindow(fake.dependencies).execute({
      websiteId: WEBSITE_ID,
      draft: mapDraft({ featureLimit: 8, locations: [LOCATION] }),
      bounds: VIEWPORT,
    });
    expect(result.isOk() && result.value.featureCount).toBe(8);
    expect(fake.windows[0]?.limit).toBe(7);
  });

  it('gives a location its own description and link, and treats empty texts as none', async () => {
    const fake = mapFakes();
    const result = await new PreviewMapWindow(fake.dependencies).execute({
      websiteId: WEBSITE_ID,
      draft: mapDraft({
        layers: [],
        locations: [
          { ...LOCATION, description: 'Open on weekdays.', href: '/contact' },
          { ...LOCATION, id: 'library', description: '', href: '' },
        ],
      }),
      bounds: VIEWPORT,
    });
    const features = result.isOk() ? (result.value.layers[0]?.features ?? []) : [];
    expect(features[0]).toMatchObject({ description: 'Open on weekdays.', href: '/contact' });
    expect(features[1]?.description).toBeUndefined();
    expect(features[1]?.href).toBeUndefined();
  });

  it('refuses a location description or link that is too long or not text', () => {
    const tooLong = (field: 'description' | 'href', length: number) =>
      mapDraft({ layers: [], locations: [{ ...LOCATION, [field]: 'x'.repeat(length) }] });
    expect(createSavedMapDraft(tooLong('description', 500)).isOk()).toBe(true);
    expect(createSavedMapDraft(tooLong('description', 501)).isErr()).toBe(true);
    expect(createSavedMapDraft(tooLong('href', 2049)).isErr()).toBe(true);
    expect(
      createSavedMapDraft(
        mapDraft({ layers: [], locations: [{ ...LOCATION, href: 5 as unknown as string }] }),
      ).isErr(),
    ).toBe(true);
  });

  it('preserves legacy dataset-only maps', () => {
    expect(createSavedMapDraft(mapDraft()).isOk()).toBe(true);
    expect(savedMapDraftSchema.safeParse(mapDraft()).success).toBe(true);
  });

  it('rejects empty maps, invalid coordinates, duplicate IDs and too many locations at both boundaries', () => {
    const invalid = [
      mapDraft({ layers: [] }),
      mapDraft({ layers: [], locations: [{ ...LOCATION, latitude: 91 }] }),
      mapDraft({ layers: [], locations: [{ ...LOCATION, longitude: Number.NaN }] }),
      mapDraft({ layers: [], locations: [LOCATION, LOCATION] }),
      mapDraft({
        layers: [],
        locations: Array.from({ length: 51 }, (_, i) => ({ ...LOCATION, id: String(i) })),
      }),
      mapDraft({
        featureLimit: 8,
        locations: Array.from({ length: 8 }, (_, i) => ({ ...LOCATION, id: String(i) })),
      }),
    ];
    for (const draft of invalid) {
      expect(createSavedMapDraft(draft).isErr()).toBe(true);
      expect(savedMapDraftSchema.safeParse(draft).success).toBe(false);
    }
  });

  it('keeps write and tenant authorization for maps without datasets', async () => {
    const fake = mapFakes();
    fake.deniedPermissions.add('page.update');
    expect(
      (
        await new SaveMap(fake.dependencies).execute({ websiteId: WEBSITE_ID, ...locationDraft() })
      ).isErr(),
    ).toBe(true);
    expect(
      (
        await new PreviewMapWindow(fake.dependencies).execute({
          websiteId: OTHER_WEBSITE_ID,
          draft: locationDraft(),
          bounds: VIEWPORT,
        })
      ).isErr(),
    ).toBe(true);
    expect(fake.stored.size).toBe(0);
  });
});
