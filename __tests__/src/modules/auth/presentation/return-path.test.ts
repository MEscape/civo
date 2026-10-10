import { describe, expect, it } from 'vitest';

import {
  RETURN_PATH_MAX_LENGTH,
  resolveReturnPath,
} from '@modules/auth/presentation/navigation/return-path';
import { DEFAULT_RETURN_PATH } from '@modules/auth/presentation/routes';

describe('resolveReturnPath', () => {
  it('keeps a same-site path with its query', () => {
    expect(resolveReturnPath('/websites/42?tab=pages')).toBe('/websites/42?tab=pages');
  });

  it('drops the fragment', () => {
    expect(resolveReturnPath('/websites#top')).toBe('/websites');
  });

  it('never lets a backslash host become a path to another site', () => {
    const resolved = resolveReturnPath('/\\evil.example');
    expect(resolved.startsWith('/')).toBe(true);
    expect(resolved.startsWith('//')).toBe(false);
    expect(resolved).not.toContain('\\');
  });

  it.each([
    ['nothing', undefined],
    ['a relative path', 'websites'],
    ['an absolute URL', 'https://evil.example/websites'],
    ['a protocol-relative URL', '//evil.example'],
    ['a tab-obfuscated host', '/\t/evil.example'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['an over-long path', `/${'a'.repeat(RETURN_PATH_MAX_LENGTH)}`],
  ])('falls back to the default for %s', (_name, raw) => {
    expect(resolveReturnPath(raw)).toBe(DEFAULT_RETURN_PATH);
  });
});
