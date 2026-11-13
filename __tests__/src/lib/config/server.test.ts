// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readServerSecret } from '@lib/config/server';

vi.mock('server-only', () => ({}));

describe('readServerSecret', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads a runtime-created credential by its name', () => {
    vi.stubEnv('CIVO_TEST_SECRET', 's3cret');

    expect(readServerSecret('CIVO_TEST_SECRET')).toBe('s3cret');
  });

  it('is undefined for a credential that is not set', () => {
    expect(readServerSecret('CIVO_TEST_UNSET_SECRET')).toBeUndefined();
  });

  it('refuses a name that is not a plain variable name, so a caller cannot read other keys', () => {
    vi.stubEnv('CIVO_TEST_SECRET', 's3cret');

    expect(readServerSecret('CIVO_TEST_SECRET; rm')).toBeUndefined();
    expect(readServerSecret('1ABC')).toBeUndefined();
    expect(readServerSecret('')).toBeUndefined();
  });
});
