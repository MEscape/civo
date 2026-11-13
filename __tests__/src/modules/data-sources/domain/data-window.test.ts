import { describe, expect, it } from 'vitest';

import {
  isDataWindowPolicy,
  orderedWindowRecords,
  resolveDataWindow,
} from '@modules/data-sources/domain/pagination/data-window';
import type { DataWindowPolicy } from '@modules/data-sources/domain/pagination/data-window';

const POLICY: DataWindowPolicy = {
  schemaVersion: 1,
  maxRecords: 100,
  maxOffset: 500,
  orderBy: { field: 'observedAt', direction: 'desc' },
};

describe('source data windows', () => {
  it('preserves valid map bounds and record position', () => {
    const request = { limit: 50, offset: 100, bounds: [9, 49, 10, 50] as const };
    expect(resolveDataWindow(request, POLICY)._unsafeUnwrap()).toEqual(request);
  });

  it.each([
    { limit: 101, offset: 0 },
    { limit: 10, offset: 501 },
    { limit: 0, offset: 0 },
    { limit: 10, offset: -1 },
    { limit: Number.NaN, offset: 0 },
  ])('refuses requests outside source/platform budgets: %j', (request) => {
    expect(resolveDataWindow(request, POLICY).isErr()).toBe(true);
  });

  it('keeps legacy unconfigured windows compatible', () => {
    expect(resolveDataWindow({ limit: 1000, offset: 0 }).isOk()).toBe(true);
  });

  it('orders newest observations before paging without mutating the snapshot', () => {
    const records = [
      { observedAt: '2026-11-06T06:00:00.000Z', value: 1 },
      { observedAt: '2026-11-06T07:00:00.000Z', value: 2 },
    ];
    expect(orderedWindowRecords(records, POLICY).map((record) => record.value)).toEqual([2, 1]);
    expect(records.map((record) => record.value)).toEqual([1, 2]);
  });

  it('supports ascending numeric windows and leaves unconfigured ordering alone', () => {
    const records = [{ value: 10 }, { value: 2 }];
    expect(
      orderedWindowRecords(records, { ...POLICY, orderBy: { field: 'value', direction: 'asc' } }),
    ).toEqual([{ value: 2 }, { value: 10 }]);
    expect(orderedWindowRecords(records)).toBe(records);
  });

  it('validates stored policies rather than trusting their version', () => {
    expect(isDataWindowPolicy(POLICY)).toBe(true);
    for (const raw of [
      { ...POLICY, schemaVersion: 2 },
      { ...POLICY, maxRecords: 0 },
      { ...POLICY, maxOffset: 1.5 },
      { ...POLICY, orderBy: { field: '__proto__', direction: 'asc' } },
      { ...POLICY, unknown: true },
    ]) {
      expect(isDataWindowPolicy(raw)).toBe(false);
    }
  });
});
