import { describe, expect, it } from 'vitest';

import { isEmptyChanges, onlyRealChanges } from '@modules/website/domain/models/website';

const stored = { name: 'Musterstadt', description: 'Old text' };

describe('onlyRealChanges', () => {
  it('keeps only the fields that differ from the stored website', () => {
    expect(onlyRealChanges({ name: 'Musterstadt', description: 'New text' }, stored)).toEqual({
      description: 'New text',
    });
  });

  it('treats clearing the description as a change', () => {
    expect(onlyRealChanges({ name: 'Musterstadt', description: null }, stored)).toEqual({
      description: null,
    });
  });

  it('leaves nothing to save when the form sends what is stored', () => {
    expect(isEmptyChanges(onlyRealChanges({ ...stored }, stored))).toBe(true);
  });
});
