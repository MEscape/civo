import { describe, expect, it } from 'vitest';

import type { CategoryOptionsDto } from '@modules/builder/presentation/dto/category-options-dto';
import { categoryChoices } from '@modules/builder/presentation/properties/category-choices';

const OPTIONS: CategoryOptionsDto = {
  byDataset: { north: ['Nord', 'Mitte'], south: ['Mitte', 'Süd'], empty: [] },
  sampleByKind: { WasteCollectionEntry: ['Bezirk A'] },
};

describe('categoryChoices', () => {
  it('offers the sample categories while nothing is bound', () => {
    expect(categoryChoices(OPTIONS, { kind: 'WasteCollectionEntry', datasetIds: [] })).toEqual([
      'Bezirk A',
    ]);
  });

  it('offers the categories of the bound dataset', () => {
    expect(
      categoryChoices(OPTIONS, { kind: 'WasteCollectionEntry', datasetIds: ['north'] }),
    ).toEqual(['Mitte', 'Nord']);
  });

  it('merges several datasets without repeats', () => {
    expect(
      categoryChoices(OPTIONS, { kind: 'WasteCollectionEntry', datasetIds: ['north', 'south'] }),
    ).toEqual(['Mitte', 'Nord', 'Süd']);
  });

  it('offers nothing for an unknown dataset or kind', () => {
    expect(categoryChoices(OPTIONS, { kind: 'Event', datasetIds: [] })).toEqual([]);
    expect(categoryChoices(OPTIONS, { kind: 'Event', datasetIds: ['missing', 'empty'] })).toEqual(
      [],
    );
  });

  it('is not confused by ids that name inherited object members', () => {
    expect(categoryChoices(OPTIONS, { kind: 'toString', datasetIds: [] })).toEqual([]);
    expect(categoryChoices(OPTIONS, { kind: 'Event', datasetIds: ['constructor'] })).toEqual([]);
  });
});
