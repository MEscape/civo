import { describe, expect, it } from 'vitest';

import {
  readSnapshotSourceConfig,
  SNAPSHOT_LIMITS,
} from '@modules/data-sources/domain/config/snapshot-source-config';
import type { DataProvenance } from '@modules/data-sources/domain/models/data-provenance';
import {
  createDataSourceDraft,
  parseDataSourceChanges,
} from '@modules/data-sources/domain/models/data-source';

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

const CONFIG = {
  schemaVersion: 1,
  records: [{ id: 'notice-1', title: 'Synthetischer Testhinweis', value: null }],
  provenance: PROVENANCE,
};

function createMock(config: unknown) {
  return createDataSourceDraft({
    websiteId: SOURCE.websiteId,
    name: 'Reference city fixture',
    kind: 'MOCK',
    config,
  });
}

describe('snapshot source configuration', () => {
  it('preserves the legacy empty MOCK configuration without claiming a readable snapshot', () => {
    expect(createMock({})._unsafeUnwrap().config).toEqual({});
    expect(readSnapshotSourceConfig({})).toBeNull();
  });

  it('accepts explicit synthetic evidence and preserves records through creation and editing', () => {
    expect(readSnapshotSourceConfig(CONFIG)).toEqual(CONFIG);
    expect(createMock(CONFIG)._unsafeUnwrap().config).toEqual(CONFIG);
    const changed = parseDataSourceChanges(
      { ...SOURCE, kind: 'MOCK', config: {} },
      { name: 'Updated fixture', config: CONFIG },
    );
    expect(changed._unsafeUnwrap().config).toEqual(CONFIG);
  });

  it('requires documented source, license and attribution for a recorded snapshot', () => {
    const provenance = {
      ...PROVENANCE,
      kind: 'snapshot',
      sourceUrl: 'https://example.invalid/open-data/notices',
      license: 'Test fixture license',
      licenseUrl: 'https://example.invalid/license',
      attribution: 'Test publisher',
    };
    expect(readSnapshotSourceConfig({ ...CONFIG, provenance })).toEqual({ ...CONFIG, provenance });
    for (const field of ['sourceUrl', 'license', 'attribution']) {
      expect(
        readSnapshotSourceConfig({ ...CONFIG, provenance: { ...provenance, [field]: null } }),
      ).toBeNull();
    }
  });

  it('allows an empty snapshot without adding invented records', () => {
    expect(readSnapshotSourceConfig({ ...CONFIG, records: [] })?.records).toEqual([]);
  });

  it.each([
    null,
    [],
    { extraKey: 'value' },
    { ...CONFIG, schemaVersion: 2 },
    { ...CONFIG, extraKey: 'value' },
    { ...CONFIG, records: null },
    { ...CONFIG, records: [null] },
    { ...CONFIG, records: [1] },
    { ...CONFIG, provenance: { ...PROVENANCE, kind: 'live' } },
    { ...CONFIG, provenance: { ...PROVENANCE, extraKey: 'value' } },
  ])('rejects malformed configuration %#', (config) => {
    expect(createMock(config).isErr()).toBe(true);
    expect(readSnapshotSourceConfig(config)).toBeNull();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects a nonfinite record value: %s',
    (value) => {
      expect(createMock({ ...CONFIG, records: [{ value }] }).isErr()).toBe(true);
    },
  );

  it('rejects records whose nesting exceeds the configured depth', () => {
    let nested: unknown = 'value';
    for (let depth = 0; depth <= SNAPSHOT_LIMITS.depth; depth += 1) {
      nested = { child: nested };
    }
    expect(createMock({ ...CONFIG, records: [{ nested }] }).isErr()).toBe(true);
  });

  it('bounds record count and combined payload size', () => {
    const tooMany = Array.from({ length: SNAPSHOT_LIMITS.records + 1 }, () => ({ id: 'row' }));
    expect(createMock({ ...CONFIG, records: tooMany }).isErr()).toBe(true);
    const tooLarge = [{ description: 'x'.repeat(SNAPSHOT_LIMITS.weight) }];
    expect(createMock({ ...CONFIG, records: tooLarge }).isErr()).toBe(true);
  });

  it.each(['not-a-date', '2026-13-01T00:00:00.000Z', '2026-11-06T25:00:00.000Z'])(
    'rejects an invalid provenance timestamp: %s',
    (fetchedAt) => {
      expect(createMock({ ...CONFIG, provenance: { ...PROVENANCE, fetchedAt } }).isErr()).toBe(
        true,
      );
    },
  );

  it('rejects an impossible calendar date instead of allowing Date.parse to normalize it', () => {
    const fetchedAt = '2026-02-30T12:00:00.000Z';
    expect(createMock({ ...CONFIG, provenance: { ...PROVENANCE, fetchedAt } }).isErr()).toBe(true);
  });

  it('rejects invalid expiry dates and credential-bearing source addresses', () => {
    const invalidExpiry = { ...PROVENANCE, validUntil: 'not-a-date' };
    expect(createMock({ ...CONFIG, provenance: invalidExpiry }).isErr()).toBe(true);
    const sourceUrl = 'https://user:password@example.invalid/open-data';
    expect(createMock({ ...CONFIG, provenance: { ...PROVENANCE, sourceUrl } }).isErr()).toBe(true);
  });
});
