import { describe, expect, it } from 'vitest';

import { safeContentHref } from '@modules/map/presentation/hooks/content-href';

describe('safeContentHref', () => {
  it('keeps paths of this site and plain links', () => {
    expect(safeContentHref('/de/rathaus')).toBe('/de/rathaus');
    expect(safeContentHref('https://example.org/a')).toBe('https://example.org/a');
    expect(safeContentHref('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(safeContentHref('tel:+4989123456')).toBe('tel:+4989123456');
  });

  it('refuses scripts, data urls and protocol-relative addresses', () => {
    expect(safeContentHref('javascript:alert(1)')).toBeNull();
    expect(safeContentHref('  JaVaScRiPt:alert(1)')).toBeNull();
    expect(safeContentHref('data:text/html,<b>x</b>')).toBeNull();
    expect(safeContentHref('//evil.test')).toBeNull();
    expect(safeContentHref('/\\evil.test')).toBeNull();
  });

  it('refuses text that is not an address', () => {
    expect(safeContentHref('not a link')).toBeNull();
    expect(safeContentHref('')).toBeNull();
  });
  it('rejects control characters that browsers could strip into an external host', () => {
    expect(safeContentHref('/\n/evil.test')).toBeNull();
    expect(safeContentHref('/\t/evil.test')).toBeNull();
    expect(safeContentHref('/\r\\evil.test')).toBeNull();
  });
});
