import { describe, expect, it } from 'vitest';

import type { PublicComponentPlatformDependencies } from '@modules/component-platform/application/component-platform-dependencies';
import { ListContent } from '@modules/component-platform/application/queries/list-content';
import { ListContentCategories } from '@modules/component-platform/application/queries/list-content-categories';
import { COMPONENT_REGISTRY } from '@modules/component-platform/domain/components/platform-registry';
import type { ContentKind } from '@modules/component-platform/domain/content/content-definitions';
import { LIST_LIMITS } from '@modules/component-platform/domain/content/list-scale';
import { contentDatasetNotFound } from '@modules/component-platform/domain/errors/component-platform-errors';
import type {
  ContentBatch,
  ContentRequest,
  ContentSource,
  ContentSourceError,
} from '@modules/component-platform/domain/ports/content-source.port';

import type { Clock } from '@lib/clock';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

const NOW = '2030-06-01T08:00:00.000Z';
const WEBSITE_ID = 'website-1';
const FIRST = 'dataset-north';
const SECOND = 'dataset-south';

const clock: Clock = { now: () => new Date(NOW) };

interface WasteRecord {
  readonly id: string;
  readonly date: string;
  readonly wasteType: 'restmuell' | 'papier' | 'gelberSack';
  readonly district: string;
}

const RECORDS: Readonly<Record<string, readonly WasteRecord[]>> = {
  [FIRST]: [
    { id: '1', date: '2030-06-05T06:00:00.000Z', wasteType: 'restmuell', district: 'Nord' },
    { id: '2', date: '2030-06-09T06:00:00.000Z', wasteType: 'papier', district: 'Nord' },
  ],
  [SECOND]: [
    { id: '1', date: '2030-06-03T06:00:00.000Z', wasteType: 'gelberSack', district: 'Süd' },
  ],
};

/** A content source that serves fixed records per dataset and fails for the ids in `failing`. */
class FakeContentSource implements ContentSource {
  readonly requested: string[] = [];
  readonly windows: Array<ContentRequest<ContentKind>['window']> = [];
  hasMore = false;

  constructor(private readonly failing: ReadonlySet<string> = new Set()) {}

  list<K extends ContentKind>(
    request: ContentRequest<K>,
  ): AppResultAsync<ContentBatch<K>, ContentSourceError> {
    this.requested.push(request.datasetId);
    this.windows.push(request.window);
    if (this.failing.has(request.datasetId)) {
      return errAsync(contentDatasetNotFound());
    }
    // The fake only holds waste records; the tests below only ask for that kind.
    const items = (RECORDS[request.datasetId] ?? []) as unknown as ContentBatch<K>['items'];
    return okAsync({ items, hasMore: this.hasMore });
  }
}

function dependencies(source: ContentSource): PublicComponentPlatformDependencies {
  return { registry: COMPONENT_REGISTRY, live: source, clock };
}

describe('ListContent with several datasets', () => {
  const request = {
    kind: 'WasteCollectionEntry',
    mode: 'published',
    websiteId: WEBSITE_ID,
  } as const;

  it('keeps a single dataset exactly as before, ids untouched', async () => {
    const source = new FakeContentSource();
    const result = await new ListContent(dependencies(source)).execute({
      ...request,
      datasetId: FIRST,
    });

    const view = result._unsafeUnwrap();
    expect(view.items.map((item) => item.id)).toEqual(['1', '2']);
    expect(view.origin).toEqual({ kind: 'live' });
  });

  it('merges the primary and further datasets into one list ordered by date', async () => {
    const source = new FakeContentSource();
    const result = await new ListContent(dependencies(source)).execute({
      ...request,
      datasetId: FIRST,
      additionalDatasetIds: [SECOND],
    });

    const view = result._unsafeUnwrap();
    expect(view.items.map((item) => item.district)).toEqual(['Süd', 'Nord', 'Nord']);
    expect(source.requested).toEqual([FIRST, SECOND]);
  });

  it('keeps record ids unique when two datasets reuse the same id', async () => {
    const result = await new ListContent(dependencies(new FakeContentSource())).execute({
      ...request,
      datasetId: FIRST,
      additionalDatasetIds: [SECOND],
    });

    const ids = result._unsafeUnwrap().items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reads a dataset named twice once, and ignores blank entries', async () => {
    const source = new FakeContentSource();
    await new ListContent(dependencies(source)).execute({
      ...request,
      datasetId: FIRST,
      additionalDatasetIds: [FIRST, '  ', SECOND],
    });

    expect(source.requested).toEqual([FIRST, SECOND]);
  });

  it('applies the category filter and the limit across all datasets', async () => {
    const result = await new ListContent(dependencies(new FakeContentSource())).execute({
      ...request,
      datasetId: FIRST,
      additionalDatasetIds: [SECOND],
      category: 'Nord',
      limit: 1,
    });

    const view = result._unsafeUnwrap();
    expect(view.items).toHaveLength(1);
    expect(view.items[0]?.district).toBe('Nord');
    expect(view.truncated).toBe(true);
  });

  it('fails a published page when any dataset cannot be read', async () => {
    const source = new FakeContentSource(new Set([SECOND]));
    const result = await new ListContent(dependencies(source)).execute({
      ...request,
      datasetId: FIRST,
      additionalDatasetIds: [SECOND],
    });

    expect(result.isErr()).toBe(true);
  });

  it('falls back to labelled sample data in a draft when any dataset cannot be read', async () => {
    const source = new FakeContentSource(new Set([SECOND]));
    const result = await new ListContent(dependencies(source)).execute({
      ...request,
      mode: 'draft',
      datasetId: FIRST,
      additionalDatasetIds: [SECOND],
    });

    expect(result._unsafeUnwrap().origin.kind).toBe('sample');
  });

  it('treats further datasets without a primary one as bound', async () => {
    const source = new FakeContentSource();
    const result = await new ListContent(dependencies(source)).execute({
      ...request,
      additionalDatasetIds: [SECOND],
    });

    expect(result._unsafeUnwrap().origin).toEqual({ kind: 'live' });
    expect(source.requested).toEqual([SECOND]);
  });

  it('shows sample data in a draft and nothing on a published page while unbound', async () => {
    const deps = dependencies(new FakeContentSource());
    const draft = await new ListContent(deps).execute({ ...request, mode: 'draft' });
    const published = await new ListContent(deps).execute(request);

    expect(draft._unsafeUnwrap().origin).toEqual({ kind: 'sample', cause: null });
    expect(published._unsafeUnwrap().items).toEqual([]);
  });
});

describe('ListContentCategories', () => {
  it('offers the distinct, sorted categories of each requested dataset', async () => {
    const result = await new ListContentCategories(dependencies(new FakeContentSource())).execute({
      websiteId: WEBSITE_ID,
      kinds: ['WasteCollectionEntry'],
      datasets: [
        { id: FIRST, kind: 'WasteCollectionEntry' },
        { id: SECOND, kind: 'WasteCollectionEntry' },
      ],
    });

    expect(result._unsafeUnwrap().byDataset).toEqual({ [FIRST]: ['Nord'], [SECOND]: ['Süd'] });
  });

  it('offers the sample data categories for components that are not bound yet', async () => {
    const result = await new ListContentCategories(dependencies(new FakeContentSource())).execute({
      websiteId: WEBSITE_ID,
      kinds: ['ServiceDetail', 'WasteCollectionEntry', 'NotAKind'],
      datasets: [],
    });

    const { sampleByKind } = result._unsafeUnwrap();
    expect(sampleByKind['ServiceDetail']).toEqual(['Bauen', 'Bürgerservice', 'Steuern']);
    expect(sampleByKind['WasteCollectionEntry']).toEqual(['Bezirk A']);
    expect(sampleByKind).not.toHaveProperty('NotAKind');
  });

  it('offers no categories for a dataset that cannot be read instead of failing the editor', async () => {
    const result = await new ListContentCategories(
      dependencies(new FakeContentSource(new Set([FIRST]))),
    ).execute({
      websiteId: WEBSITE_ID,
      kinds: [],
      datasets: [
        { id: FIRST, kind: 'WasteCollectionEntry' },
        { id: SECOND, kind: 'WasteCollectionEntry' },
      ],
    });

    expect(result._unsafeUnwrap().byDataset).toEqual({ [FIRST]: [], [SECOND]: ['Süd'] });
  });
});

describe('ListContent window', () => {
  const request = {
    kind: 'WasteCollectionEntry',
    mode: 'published',
    websiteId: WEBSITE_ID,
    datasetId: FIRST,
  } as const;

  it('reads exactly the Limit the editor set, from the start of the dataset', async () => {
    const source = new FakeContentSource();

    await new ListContent(dependencies(source)).execute({ ...request, limit: 7 });

    expect(source.windows).toEqual([{ limit: 7, offset: 0 }]);
  });

  it('moves the window where the visitor moved it, and bounds it by the kind', async () => {
    const source = new FakeContentSource();

    await new ListContent(dependencies(source)).execute({ ...request, limit: 5_000, offset: 40 });

    expect(source.windows).toEqual([{ limit: LIST_LIMITS.cards.max, offset: 40 }]);
  });

  it('says the list was cut when the dataset holds more than the window', async () => {
    const source = new FakeContentSource();
    source.hasMore = true;

    const view = (
      await new ListContent(dependencies(source)).execute({ ...request, limit: 10 })
    )._unsafeUnwrap();

    expect(view.truncated).toBe(true);
  });
});
