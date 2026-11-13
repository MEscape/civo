import { describe, expect, it } from 'vitest';

import type { DataProvenance } from '@modules/data-sources/domain/models/data-provenance';
import type { DataSource } from '@modules/data-sources/domain/models/data-source';
import { READ_WINDOW_LIMITS } from '@modules/data-sources/domain/pagination/read-window';
import type { ReadWindow } from '@modules/data-sources/domain/pagination/read-window';
import { SnapshotConnector } from '@modules/data-sources/infrastructure/connector/snapshot-connector';

import { SOURCE } from '../support/data-source-fixtures';

const PROVENANCE = {
  kind: 'synthetic',
  sourceId: 'reference-city-fixture',
  sourceUrl: null,
  fetchedAt: '2026-11-06T12:00:00.000Z',
  validUntil: null,
  license: null,
  licenseUrl: null,
  attribution: null,
} as const satisfies DataProvenance;

const RECORDS = [
  { id: 'one', title: 'Erster Testhinweis' },
  { id: 'two', title: 'Zweiter Testhinweis' },
  { id: 'three', title: 'Dritter Testhinweis' },
  { id: 'four', title: 'Vierter Testhinweis' },
];
const CONFIG = { schemaVersion: 1, records: RECORDS, provenance: PROVENANCE };
const WINDOW = { limit: 2, offset: 0 };

function source(config: unknown = CONFIG): DataSource {
  return { ...SOURCE, kind: 'MOCK', config };
}

describe('SnapshotConnector', () => {
  it('checks a stored snapshot without a network dependency', async () => {
    const connector = new SnapshotConnector();
    const tested = await connector.test(source());
    expect(tested.isOk()).toBe(true);
  });

  it('returns one extra record so the existing mapper can report truncation', async () => {
    const connector = new SnapshotConnector();
    const result = await connector.fetchBody(source(), { window: WINDOW });
    expect(result._unsafeUnwrap()).toEqual(
      RECORDS.slice(0, 3).map((record) => ({ ...record, _provenance: PROVENANCE })),
    );
  });

  it('applies offset before limiting and returns an empty page after the last record', async () => {
    const connector = new SnapshotConnector();
    const page = await connector.fetchBody(source(), { window: { limit: 1, offset: 2 } });
    expect(page._unsafeUnwrap()).toEqual(
      RECORDS.slice(2).map((record) => ({ ...record, _provenance: PROVENANCE })),
    );
    const empty = await connector.fetchBody(source(), { window: { limit: 1, offset: 4 } });
    expect(empty._unsafeUnwrap()).toEqual([]);
  });

  it('attaches source evidence without mutating or trusting record-level provenance', async () => {
    const records = [{ id: 'one', _provenance: { kind: 'live' } }];
    const connector = new SnapshotConnector();
    const result = await connector.fetchBody(source({ ...CONFIG, records }), { window: WINDOW });
    expect(result._unsafeUnwrap()).toEqual([{ id: 'one', _provenance: PROVENANCE }]);
    expect(records).toEqual([{ id: 'one', _provenance: { kind: 'live' } }]);
  });

  it('retains documented snapshot evidence instead of reporting synthetic or live data', async () => {
    const provenance = {
      ...PROVENANCE,
      kind: 'snapshot',
      sourceUrl: 'https://example.invalid/data',
      license: 'Test fixture license',
      attribution: 'Test publisher',
    };
    const connector = new SnapshotConnector();
    const result = await connector.fetchBody(source({ ...CONFIG, provenance }), { window: WINDOW });
    expect(result._unsafeUnwrap()).toEqual(
      RECORDS.slice(0, 3).map((record) => ({ ...record, _provenance: provenance })),
    );
  });

  it.each<ReadWindow>([
    { limit: 0, offset: 0 },
    { limit: 1.5, offset: 0 },
    { limit: READ_WINDOW_LIMITS.maxLimit + 1, offset: 0 },
    { limit: 1, offset: -1 },
    { limit: 1, offset: READ_WINDOW_LIMITS.maxOffset + 1 },
    { limit: 1, offset: Number.NaN },
    { limit: 1, offset: 0, bounds: [10, 50, 9, 51] },
  ])('rejects an invalid read window %#', async (window) => {
    const connector = new SnapshotConnector();
    const result = await connector.fetchBody(source(), { window });
    expect(result.isErr()).toBe(true);
    expect(result.isErr() && result.error.code).toBe('data_source.validation_failed');
  });

  it.each([undefined, null, ''])('accepts an absent dataset path: %s', async (path) => {
    const connector = new SnapshotConnector();
    const result = await connector.fetchBody(source(), { window: WINDOW, path });
    expect(result.isOk()).toBe(true);
  });

  it('refuses an unsupported dataset path instead of silently returning another dataset', async () => {
    const connector = new SnapshotConnector();
    const result = await connector.fetchBody(source(), { window: WINDOW, path: '/other-data' });
    expect(result.isErr() && result.error.code).toBe('data_source.connector_unavailable');
  });

  it.each([{}, null, { ...CONFIG, schemaVersion: 2 }, { ...CONFIG, records: [null] }])(
    'treats legacy or malformed stored configuration as unavailable %#',
    async (config) => {
      const connector = new SnapshotConnector();
      const tested = await connector.test(source(config));
      expect(tested.isErr() && tested.error.code).toBe('data_source.connector_unavailable');
      const result = await connector.fetchBody(source(config), { window: WINDOW });
      expect(result.isErr() && result.error.code).toBe('data_source.connector_unavailable');
    },
  );
});
