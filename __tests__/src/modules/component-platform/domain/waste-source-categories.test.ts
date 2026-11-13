import { describe, expect, it } from 'vitest';

import { readLegacyComponentDefaults } from '@modules/component-platform/domain/components/legacy-component-props';
import { wasteCollectionEntryContent } from '@modules/component-platform/domain/content/civic/waste-collection-entry.content';

describe('waste categories delivered by civic sources', () => {
  it.each([
    'Wertstoffmobil',
    'Christbaumabfuhr',
    'Gelbe Säcke',
    'Schadstoffsammlung',
    'gelberSack',
  ])('preserves %s rather than converting a collection to another type', (wasteType) => {
    const record = wasteCollectionEntryContent.parse({
      id: 'collection',
      date: '2026-11-06T00:00:00.000Z',
      wasteType,
      district: 'Altstadt',
    });
    expect(record.isOk()).toBe(true);
    if (record.isOk()) {
      expect(record.value.wasteType).toBe(wasteType);
    }
  });
  it('keeps previous stored calendar defaults readable', () => {
    expect(readLegacyComponentDefaults('wasteCalendar', 1)).toEqual({
      additionalDatasetIds: [],
      limit: 10,
    });
  });
  it('rejects an empty or unbounded source label', () => {
    for (const wasteType of ['', 'x'.repeat(201)]) {
      expect(
        wasteCollectionEntryContent
          .parse({ id: 'collection', date: '2026-11-06T00:00:00.000Z', wasteType })
          .isErr(),
      ).toBe(true);
    }
  });
});
