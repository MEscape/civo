import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DataSource } from '@modules/data-sources/domain/models/data-source';
import { CachedDataSourceConnector } from '@modules/data-sources/infrastructure/cache/cached-data-source-reader';

const read = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@modules/data-sources/infrastructure/cache/cached-rest-body', () => ({
  readCachedRestBody: read,
  SourceReadFailure: class extends Error {},
}));

const AREA = [9, 47, 10, 48] as const;
const config = { baseUrl: 'https://api.example.org/v1', path: '/', authMode: 'NONE' };
const source = (extra: Record<string, unknown>) =>
  ({
    id: 'source-1',
    tenantId: 'tenant-1',
    kind: 'REST',
    config: { ...config, ...extra },
  }) as unknown as DataSource;

beforeEach(() => {
  read.mockReset();
  read.mockResolvedValue([]);
});

describe('CachedDataSourceConnector', () => {
  it('keeps the area out of the cache key of a source that cannot be asked for one', async () => {
    const connector = new CachedDataSourceConnector({} as never);

    await connector.fetchBody(source({}), { window: { limit: 5, offset: 0, bounds: AREA } });

    expect(read.mock.calls[0]?.[0].window).toEqual({ limit: 5, offset: 0 });
  });

  it('keys the read by the area when the API is asked for it', async () => {
    const connector = new CachedDataSourceConnector({} as never);
    const spatialFilter = { param: 'bbox', template: '{west},{south},{east},{north}' };

    await connector.fetchBody(source({ spatialFilter }), {
      window: { limit: 5, offset: 0, bounds: AREA },
    });

    expect(read.mock.calls[0]?.[0].window).toEqual({ limit: 5, offset: 0, bounds: AREA });
  });
});
