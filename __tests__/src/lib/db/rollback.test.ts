import { describe, expect, it } from 'vitest';

import { rollbackWith, rollbackable } from '@lib/db';

describe('rolling a transaction back on purpose', () => {
  it('hands back the value of a body that finishes', async () => {
    const outcome = await rollbackable(() => Promise.resolve(42));

    expect(outcome).toEqual({ kind: 'done', value: 42 });
  });

  it('turns a rollback inside the body into its refusal, as a value', async () => {
    const outcome = await rollbackable<number, string>(async () => {
      await Promise.resolve();
      return rollbackWith('already taken');
    });

    expect(outcome).toEqual({ kind: 'rolled-back', refusal: 'already taken' });
  });

  it('lets any other failure through unchanged', async () => {
    const failure = new Error('the database went away');

    await expect(
      rollbackable(() => {
        return Promise.reject(failure);
      }),
    ).rejects.toBe(failure);
  });
});
