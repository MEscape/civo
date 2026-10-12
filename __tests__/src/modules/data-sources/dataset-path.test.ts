import { describe, expect, it } from 'vitest';

import { resolveRestEndpoint } from '@modules/data-sources/domain/config/rest-connection-config';
import {
  createDatasetDraft,
  parseDatasetChanges,
} from '@modules/data-sources/domain/models/dataset';
import { toDataSourceId } from '@modules/data-sources/domain/models/ids';

const SOURCE_ID = toDataSourceId('source-1');
const BASE = 'https://opendata.example.org/api/v2.1/catalog/datasets';

function endpointOf(baseUrl: string, path: string): string | null {
  const decision = resolveRestEndpoint({ baseUrl, path });
  return decision.isAllowed ? decision.url.toString() : null;
}

describe('dataset endpoint resolution', () => {
  it('resolves different endpoints when datasets specify paths', () => {
    expect(endpointOf(BASE, '/eventfeed/records')).toBe(`${BASE}/eventfeed/records`);
    expect(endpointOf(BASE, '/gruenderzentren/records')).toBe(`${BASE}/gruenderzentren/records`);
  });

  it('refuses a path that names a host of its own', () => {
    expect(endpointOf(BASE, '//internal.example.org/x')).toBeNull();
  });
});

describe('dataset path validation', () => {
  const input = { name: 'Events', canonicalKind: 'Event' } as const;

  it('stores a blank path as none', () => {
    const draft = createDatasetDraft(SOURCE_ID, { ...input, path: '  ' });

    expect(draft.isOk() && draft.value.path).toBeNull();
  });

  it('keeps a valid path', () => {
    const draft = createDatasetDraft(SOURCE_ID, { ...input, path: ' /eventfeed/records ' });

    expect(draft.isOk() && draft.value.path).toBe('/eventfeed/records');
  });

  it.each(['eventfeed', '//internal.example.org/x'])('rejects the path %s', (path) => {
    expect(createDatasetDraft(SOURCE_ID, { ...input, path }).isErr()).toBe(true);
  });

  it('clears the path on update with a blank value, and leaves it alone when absent', () => {
    const cleared = parseDatasetChanges({ path: '' });
    const untouched = parseDatasetChanges({ name: 'Events' });

    expect(cleared.isOk() && cleared.value.path).toBeNull();
    expect(untouched.isOk() && 'path' in untouched.value).toBe(false);
  });
});
