import { describe, expect, it } from 'vitest';

import { removeAt, replaceAt } from '@lib/utils';

describe('replaceAt / removeAt', () => {
  it('replace one item without touching the input', () => {
    const list = ['a', 'b', 'c'];
    expect(replaceAt(list, 1, 'x')).toEqual(['a', 'x', 'c']);
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('remove one item without touching the input', () => {
    const list = ['a', 'b', 'c'];
    expect(removeAt(list, 0)).toEqual(['b', 'c']);
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('leave the list as it is for an index outside it', () => {
    expect(replaceAt(['a'], 5, 'x')).toEqual(['a']);
    expect(removeAt(['a'], -1)).toEqual(['a']);
  });
});
