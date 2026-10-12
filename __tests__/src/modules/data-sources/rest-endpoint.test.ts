import { describe, expect, it } from 'vitest';

import { resolveRestEndpoint } from '@modules/data-sources/domain/config/rest-connection-config';

const BASE = 'https://opendata.example.org/api/explore/v2.1/catalog/datasets/eventfeed/records';

function resolved(baseUrl: string, path: string): string | null {
  const decision = resolveRestEndpoint({ baseUrl, path });
  return decision.isAllowed ? decision.url.toString() : null;
}

describe('resolveRestEndpoint', () => {
  it('requests the address the administrator typed when the path is the default', () => {
    expect(resolved(BASE, '/')).toBe(BASE);
  });

  it('keeps the query of the base address', () => {
    expect(resolved(`${BASE}?limit=5`, '/')).toBe(`${BASE}?limit=5`);
  });

  it('appends a path and its query to the base path', () => {
    expect(resolved('https://api.example.org/v1/', '/events?year=2026')).toBe(
      'https://api.example.org/v1/events?year=2026',
    );
  });

  it.each(['//internal.example.org/x', 'https://internal.example.org/x'])(
    'refuses a path that names a host of its own: %s',
    (path) => {
      expect(resolved(BASE, path)).toBeNull();
    },
  );

  it('still applies the address policy to the combined address', () => {
    expect(resolved('http://localhost:3000/api', '/')).toBeNull();
    expect(resolved('https://169.254.169.254/latest', '/meta-data')).toBeNull();
  });
});
