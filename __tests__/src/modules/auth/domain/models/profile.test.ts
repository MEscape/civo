import { describe, expect, it } from 'vitest';

import { createProfileDraft, PROFILE_IMAGE_MAX_BYTES } from '@modules/auth/domain/models/profile';

describe('profile drafts', () => {
  it('normalizes a display name and distinguishes preserved and removed photos', () => {
    expect(createProfileDraft({ name: '  Ada  ' })._unsafeUnwrap()).toEqual({ name: 'Ada' });
    expect(createProfileDraft({ name: 'Ada', image: null })._unsafeUnwrap()).toEqual({
      name: 'Ada',
      image: null,
    });
  });

  it.each(['', '   ', 'x'.repeat(101)])('rejects invalid name %j', (name) => {
    expect(createProfileDraft({ name })._unsafeUnwrapErr().fieldErrors).toHaveProperty('name');
  });

  it.each([
    { contentType: 'image/png', bytes: Uint8Array.from(Buffer.from('89504e470d0a1a0a', 'hex')) },
    { contentType: 'image/jpeg', bytes: Uint8Array.from(Buffer.from('ffd8ff', 'hex')) },
    { contentType: 'image/webp', bytes: Uint8Array.from(Buffer.from('RIFF0000WEBP')) },
  ])('accepts the matching $contentType signature', (image) => {
    expect(createProfileDraft({ name: 'Ada', image }).isOk()).toBe(true);
  });

  it.each([
    { contentType: 'image/png', bytes: new Uint8Array() },
    { contentType: 'image/png', bytes: Uint8Array.from(Buffer.from('<script>bad</script>')) },
    { contentType: 'image/svg+xml', bytes: Uint8Array.from(Buffer.from('<svg/>')) },
    { contentType: 'image/jpeg', bytes: Uint8Array.from(Buffer.from('89504e470d0a1a0a', 'hex')) },
    { contentType: 'image/png', bytes: new Uint8Array(PROFILE_IMAGE_MAX_BYTES + 1) },
  ])('rejects invalid, mismatched or oversized photo %#', (image) => {
    expect(
      createProfileDraft({ name: 'Ada', image })._unsafeUnwrapErr().fieldErrors,
    ).toHaveProperty('image');
  });
});
