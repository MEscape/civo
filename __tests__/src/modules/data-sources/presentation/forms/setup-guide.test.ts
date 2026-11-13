import { describe, expect, it } from 'vitest';

import { buildSetupGuide } from '@modules/data-sources/presentation/forms/setup-guide';

import { DATASET_DTO, SOURCE_DTO } from '../../support/data-source-fixtures';

const MAPPED_DATASET = { ...DATASET_DTO, mapping: { fields: [] } };
const UNMAPPED_DATASET = { ...DATASET_DTO, mapping: null };
const NONE = { kinds: [], mappedKinds: [], isTruncated: false };

function guide(overrides: Partial<Parameters<typeof buildSetupGuide>[0]> = {}) {
  return buildSetupGuide({
    websiteId: 'website-1',
    sources: [],
    total: 0,
    setup: NONE,
    usage: {},
    awaiting: [],
    ...overrides,
  });
}

describe('buildSetupGuide', () => {
  it('starts at the first step with nothing connected, and offers no button for it', () => {
    const result = guide();

    expect(result.steps.map((step) => step.isDone)).toEqual([false, false, false, false]);
    expect(result.showsGuide).toBe(true);
    expect(result.isOnlyUseLeft).toBe(false);
    expect(result.steps.every((step) => step.href === undefined)).toBe(true);
  });

  it('points the dataset step at the first source that answered', () => {
    const result = guide({
      sources: [
        { ...SOURCE_DTO, status: 'UNKNOWN' },
        { ...SOURCE_DTO, id: 'ok', status: 'OK' },
      ],
      total: 2,
    });

    expect(result.steps[1]?.href).toBe('/websites/website-1/data/ok/datasets/new');
    expect(result.steps.filter((step) => step.href !== undefined)).toHaveLength(1);
  });

  it('points the mapping step at the first dataset that is not mapped', () => {
    const result = guide({
      sources: [{ ...SOURCE_DTO, datasets: [MAPPED_DATASET, UNMAPPED_DATASET] }],
      total: 1,
      setup: { kinds: ['NewsItem'], mappedKinds: [], isTruncated: false },
    });

    expect(result.steps.map((step) => step.isDone)).toEqual([true, true, false, false]);
    expect(result.steps[2]?.href).toBe(
      `/websites/website-1/data/${SOURCE_DTO.id}/datasets/${DATASET_DTO.id}/mapping`,
    );
  });

  it('leaves only "use it on a page" once everything is mapped, and names where it goes', () => {
    const awaiting = {
      label: 'News grid',
      page: 'Home',
      kind: 'NewsItem',
      href: '/editor',
    };
    const result = guide({
      sources: [SOURCE_DTO],
      total: 1,
      setup: { kinds: ['NewsItem'], mappedKinds: ['NewsItem'], isTruncated: false },
      awaiting: [{ ...awaiting, kind: 'Event' }, awaiting],
    });

    expect(result.isOnlyUseLeft).toBe(true);
    expect(result.target).toBe(awaiting);
  });

  it('is finished, and goes away, once a draft page uses a dataset', () => {
    const result = guide({
      sources: [SOURCE_DTO],
      total: 1,
      setup: { kinds: ['NewsItem'], mappedKinds: ['NewsItem'], isTruncated: false },
      usage: {
        [DATASET_DTO.id]: [{ title: 'Home', href: '/p', components: [], where: 'draft' }],
      },
    });

    expect(result.showsGuide).toBe(false);
  });

  it('stays open while only a saved map uses a dataset: no page shows it yet', () => {
    const result = guide({
      sources: [SOURCE_DTO],
      total: 1,
      setup: { kinds: ['NewsItem'], mappedKinds: ['NewsItem'], isTruncated: false },
      usage: {
        [DATASET_DTO.id]: [{ title: 'Stations', href: '/m', components: [], where: 'map' }],
      },
    });

    expect(result.showsGuide).toBe(true);
  });
});
