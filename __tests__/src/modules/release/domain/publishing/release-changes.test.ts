import { describe, expect, it } from 'vitest';

import {
  RELEASE_NOTE_MAX_LENGTH,
  normalizeReleaseNote,
} from '@modules/release/domain/publishing/release-changes';

describe('a release note', () => {
  it('is trimmed, and absent when nothing is left', () => {
    expect(normalizeReleaseNote('  Contact updated  ')).toBe('Contact updated');
    expect(normalizeReleaseNote('   ')).toBeNull();
    expect(normalizeReleaseNote(undefined)).toBeNull();
  });

  it('never exceeds the limit, whatever was sent', () => {
    expect(normalizeReleaseNote('x'.repeat(RELEASE_NOTE_MAX_LENGTH + 50))).toHaveLength(
      RELEASE_NOTE_MAX_LENGTH,
    );
  });
});
