import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseEnv } from '@lib/config/parse-env';

const schema = z
  .object({ PORT: z.coerce.number().int().positive(), TOKEN: z.string().min(8) })
  .superRefine((env, ctx) => {
    if (env.PORT === 1) {
      ctx.addIssue({ code: 'custom', path: [], message: 'Port 1 is reserved.' });
    }
  });

describe('parseEnv', () => {
  it('returns the parsed, typed configuration', () => {
    expect(parseEnv('server', schema, { PORT: '3000', TOKEN: 'long-enough' })).toEqual({
      PORT: 3000,
      TOKEN: 'long-enough',
    });
  });

  it('throws one error listing every variable that failed, under its label', () => {
    expect(() => parseEnv('server', schema, { PORT: 'abc', TOKEN: 'x' })).toThrow(
      /^Invalid server environment configuration:\n {2}- PORT: .+\n {2}- TOKEN: .+$/,
    );
  });

  it('names a problem with the configuration as a whole', () => {
    expect(() => parseEnv('public', schema, { PORT: '1', TOKEN: 'long-enough' })).toThrow(
      'Invalid public environment configuration:\n  - (configuration): Port 1 is reserved.',
    );
  });

  it('never puts the rejected value in the message: it may be a secret', () => {
    expect.assertions(1);
    try {
      parseEnv('server', schema, { PORT: '3000', TOKEN: 'sekrit' });
    } catch (error) {
      expect((error as Error).message).not.toContain('sekrit');
    }
  });
});
