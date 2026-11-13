import { describe, expect, it } from 'vitest';

import { ListContent } from '@modules/component-platform/application/queries/list-content';
import { COMPONENT_REGISTRY } from '@modules/component-platform/domain/components/platform-registry';
import { toDatasetId, toWebsiteId } from '@modules/component-platform/domain/models/ids';
import { DatasetContentSource } from '@modules/component-platform/infrastructure/data-sources/dataset-content-source';
import type { MappedRecordsView } from '@modules/data-sources';

import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const EVIDENCE = {
  kind: 'snapshot',
  sourceId: 'gauge',
  sourceUrl: 'https://example.invalid/gauge',
  fetchedAt: '2026-11-06T08:00:00.000Z',
  validUntil: null,
  license: 'License',
  licenseUrl: null,
  attribution: 'Publisher',
} as const;
const VIEW: MappedRecordsView = {
  datasetId: 'dataset',
  canonicalKind: 'SmartCityMetric',
  records: [
    {
      id: 'authoritative',
      values: { id: 'forged', label: 'Main', value: 142, unit: 'cm', category: 'Gewässer' },
    },
  ],
  skipped: 0,
  truncated: false,
  isAreaApplied: false,
  provenance: EVIDENCE,
};
const REQUEST = {
  kind: 'SmartCityMetric',
  datasetId: toDatasetId('dataset'),
  websiteId: toWebsiteId('website'),
  window: { limit: 10, offset: 0 },
} as const;

describe('dataset content provenance boundary', () => {
  it('retains source evidence and the authoritative record identity', async () => {
    const result = await new DatasetContentSource(() => okAsync(VIEW)).list(REQUEST);
    const batch = result._unsafeUnwrap();
    expect(batch.provenance).toEqual(EVIDENCE);
    expect(batch.items[0]?.id).toBe('authoritative');
  });

  it('exposes rejected canonical records together with upstream mapping failures', async () => {
    const source = new DatasetContentSource(() =>
      okAsync({
        ...VIEW,
        skipped: 2,
        records: [...VIEW.records, { id: 'broken', values: { label: 'Bad', value: Number.NaN } }],
      }),
    );
    const batch = (await source.list(REQUEST))._unsafeUnwrap();
    expect(batch.items).toHaveLength(1);
    expect(batch.rejected).toBe(3);
  });

  it('preserves evidence from every contributing dataset through selection', async () => {
    const source = new DatasetContentSource((request) =>
      okAsync({
        ...VIEW,
        datasetId: request.datasetId,
        provenance: { ...EVIDENCE, sourceId: request.datasetId },
      }),
    );
    const query = new ListContent({
      registry: COMPONENT_REGISTRY,
      live: source,
      clock: { now: () => new Date(EVIDENCE.fetchedAt) },
    });
    const view = (
      await query.execute({
        kind: 'SmartCityMetric',
        mode: 'published',
        websiteId: 'website',
        datasetId: 'north',
        additionalDatasetIds: ['south'],
      })
    )._unsafeUnwrap();
    expect(view.origin.kind).toBe('live');
    if (view.origin.kind === 'live') {
      expect(view.origin.sources?.map((evidence) => evidence.sourceId)).toEqual(['north', 'south']);
    }
  });

  it('does not convert a source failure into invented public records', async () => {
    const query = new DatasetContentSource(() =>
      errAsync(infrastructureError('test.unavailable', 'Source unavailable')),
    );
    expect((await query.list(REQUEST)).isErr()).toBe(true);
  });
});
