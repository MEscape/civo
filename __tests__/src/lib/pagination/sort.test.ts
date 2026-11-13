import { describe, expect, it } from 'vitest';

import { nextSort } from '@lib/pagination';

describe('nextSort', () => {
  it('sorts a new column ascending', () => {
    expect(nextSort({ field: 'name', direction: 'asc' }, 'email')).toEqual({
      field: 'email',
      direction: 'asc',
    });
  });

  it('flips the current column', () => {
    expect(nextSort({ field: 'name', direction: 'asc' }, 'name')).toEqual({
      field: 'name',
      direction: 'desc',
    });
    expect(nextSort({ field: 'name', direction: 'desc' }, 'name')).toEqual({
      field: 'name',
      direction: 'asc',
    });
  });
});
