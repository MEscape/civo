import { describe, expect, it } from 'vitest';

import { listMediaSchema } from '@modules/media/presentation/schemas/list-media-schema';
import { mediaTargetSchema } from '@modules/media/presentation/schemas/media-target-schema';
import { requestUploadSchema } from '@modules/media/presentation/schemas/request-upload-schema';

import { WEBSITE_ID } from '../../support/media-intl';

describe('request schema', () => {
  const valid = {
    websiteId: WEBSITE_ID,
    fileName: 'a.png',
    contentType: 'image/png',
    byteSize: 10,
  };

  it('defaults to a public file', () => {
    expect(requestUploadSchema.parse(valid).visibility).toBe('public');
  });

  it('names the website, and drops any tenant the client adds', () => {
    const parsed = requestUploadSchema.parse({ ...valid, tenantId: 'someone-else' });
    expect(parsed.websiteId).toBe(WEBSITE_ID);
    expect(parsed).not.toHaveProperty('tenantId');
    expect(requestUploadSchema.safeParse({ ...valid, websiteId: undefined }).success).toBe(false);
  });

  it('bounds the shape of what arrives', () => {
    expect(requestUploadSchema.safeParse({ ...valid, fileName: 'x'.repeat(2000) }).success).toBe(
      false,
    );
    expect(requestUploadSchema.safeParse({ ...valid, byteSize: 1.5 }).success).toBe(false);
    expect(requestUploadSchema.safeParse({ ...valid, visibility: 'internal' }).success).toBe(false);
  });
});

describe('the other action schemas', () => {
  it('needs both the website and the file for an action on one file', () => {
    expect(mediaTargetSchema.safeParse({ websiteId: WEBSITE_ID, id: 'abc' }).success).toBe(true);
    expect(mediaTargetSchema.safeParse({ id: 'abc' }).success).toBe(false);
    expect(mediaTargetSchema.safeParse({ websiteId: WEBSITE_ID }).success).toBe(false);
  });

  it('lists one website, optionally one kind of file', () => {
    expect(listMediaSchema.parse({ websiteId: WEBSITE_ID, visibility: 'public' }).visibility).toBe(
      'public',
    );
    expect(listMediaSchema.safeParse({ websiteId: WEBSITE_ID, visibility: 'x' }).success).toBe(
      false,
    );
    expect(listMediaSchema.safeParse({}).success).toBe(false);
  });
});
