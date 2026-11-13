import { describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth';
import { parseMediaAssetId, toMediaAssetId } from '@modules/media/domain/models/ids';
import {
  MEDIA_LIMITS,
  mediaObjectKey,
  parseUploadRequest,
  sanitizeFileName,
} from '@modules/media/domain/models/media-asset';
import { sniffMediaFormat } from '@modules/media/domain/models/media-format';

import { HTML, JPEG, PNG } from '../support/fakes';

const ok = { fileName: 'a.png', contentType: 'image/png', byteSize: 100, visibility: 'public' };
const fieldsOf = (input: Parameters<typeof parseUploadRequest>[0]) =>
  Object.keys(parseUploadRequest(input)._unsafeUnwrapErr().fieldErrors);

describe('parseUploadRequest', () => {
  it('accepts every announced image format, public or private', () => {
    for (const contentType of [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/gif',
    ]) {
      for (const visibility of ['public', 'private']) {
        expect(parseUploadRequest({ ...ok, contentType, visibility }).isOk()).toBe(true);
      }
    }
  });

  it('treats the content type case-insensitively but never as free text', () => {
    expect(
      parseUploadRequest({ ...ok, contentType: ' IMAGE/PNG ' })._unsafeUnwrap().contentType,
    ).toBe('image/png');
  });

  it.each([
    ['SVG, which can carry script', 'image/svg+xml'],
    ['HTML', 'text/html'],
    ['an executable', 'application/x-msdownload'],
    ['a PDF, which is not accepted yet', 'application/pdf'],
    ['a type with parameters', 'image/png; charset=utf-8'],
    ['nothing', ''],
  ])('refuses %s', (_label, contentType) => {
    expect(fieldsOf({ ...ok, contentType })).toEqual(['contentType']);
  });

  it.each([0, -1, 1.5, Number.NaN, MEDIA_LIMITS.maxBytes + 1])(
    'refuses the size %s',
    (byteSize) => {
      expect(fieldsOf({ ...ok, byteSize })).toEqual(['byteSize']);
    },
  );

  it('accepts exactly the largest size', () => {
    expect(parseUploadRequest({ ...ok, byteSize: MEDIA_LIMITS.maxBytes }).isOk()).toBe(true);
  });

  it('refuses a visibility it does not know, and a name that is empty once cleaned', () => {
    expect(fieldsOf({ ...ok, visibility: 'internal' })).toEqual(['visibility']);
    expect(fieldsOf({ ...ok, fileName: ' \u202e\u0000 ' })).toEqual(['fileName']);
  });

  it('reports every wrong field at once', () => {
    expect(
      fieldsOf({ fileName: '', contentType: 'x', byteSize: 0, visibility: 'y' }).sort(),
    ).toEqual(['byteSize', 'contentType', 'fileName', 'visibility']);
  });
});

describe('sanitizeFileName', () => {
  it.each([
    ['../../etc/passwd', 'passwd'],
    ['C:\\Users\\me\\photo.png', 'photo.png'],
    ['a/b/c.png', 'c.png'],
    ['photo\u0000.png', 'photo.png'],
    ['photo\n\t.png', 'photo.png'],
    ['evil\u202egnp.exe', 'evilgnp.exe'],
    ['  many   spaces .png', 'many spaces .png'],
    ['Cafe\u0301.png', 'Café.png'],
  ])('turns %j into %j', (raw, expected) => {
    expect(sanitizeFileName(raw)).toBe(expected);
  });

  it('shortens a very long name', () => {
    expect(sanitizeFileName('x'.repeat(500))).toHaveLength(MEDIA_LIMITS.fileNameMax);
  });
});

describe('the object key', () => {
  it('is built from the tenant and the asset id only, never from a file name', () => {
    const key = mediaObjectKey(
      toTenantId('site-1'),
      toMediaAssetId('9b0d6b5e-6a0f-4f6e-8e6c-1d2c3b4a5f60'),
    );
    expect(key).toBe('sites/site-1/media/9b0d6b5e-6a0f-4f6e-8e6c-1d2c3b4a5f60');
  });
});

describe('parseMediaAssetId', () => {
  it('accepts a UUID', () => {
    expect(parseMediaAssetId('9b0d6b5e-6a0f-4f6e-8e6c-1d2c3b4a5f60').isOk()).toBe(true);
  });

  it.each([
    '',
    '../x',
    'a/b',
    '9b0d6b5e',
    'not-a-uuid',
    '9b0d6b5e-6a0f-4f6e-8e6c-1d2c3b4a5f60/../x',
    ' ',
  ])('refuses %j, because the id becomes part of an object key', (raw) => {
    expect(parseMediaAssetId(raw)._unsafeUnwrapErr().fieldErrors).toHaveProperty('id');
  });
});

describe('sniffMediaFormat', () => {
  const bytes = (...values: number[]) =>
    new Uint8Array([...values, ...new Array<number>(32).fill(0)]);
  const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

  it('recognises each accepted format by its signature', () => {
    expect(sniffMediaFormat(PNG)).toBe('image/png');
    expect(sniffMediaFormat(JPEG)).toBe('image/jpeg');
    expect(sniffMediaFormat(bytes(...ascii('GIF89a')))).toBe('image/gif');
    expect(sniffMediaFormat(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')))).toBe(
      'image/webp',
    );
    expect(sniffMediaFormat(bytes(0, 0, 0, 0x1c, ...ascii('ftypavif')))).toBe('image/avif');
  });

  it.each([
    ['HTML', HTML],
    ['SVG', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')],
    ['a Windows executable', bytes(0x4d, 0x5a, 0x90, 0)],
    ['an empty file', new Uint8Array()],
    ['RIFF that is not WebP', bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE'))],
    ['an MP4, whose container looks like AVIF', bytes(0, 0, 0, 0x1c, ...ascii('ftypmp42'))],
  ])('does not take %s for an image', (_label, content) => {
    expect(sniffMediaFormat(content)).toBeNull();
  });
});
