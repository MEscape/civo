import { describe, expect, it, vi } from 'vitest';

import type { MediaAssetDto, RequestedUploadDto } from '@modules/media/presentation/dto/media-dto';
import { TRANSFER_FAILED_CODE } from '@modules/media/presentation/messages/message-keys';
import { createMediaUploader } from '@modules/media/presentation/upload/upload-media-file';

import type { ActionResult } from '@lib/result';

import { WEBSITE_ID } from '../../support/media-intl';

const asset: MediaAssetDto = {
  id: '9b0d6b5e-6a0f-4f6e-8e6c-1d2c3b4a5f60',
  originalFilename: 'a.png',
  contentType: 'image/png',
  byteSize: 4,
  visibility: 'public',
  status: 'pending',
  createdAt: '2026-10-18T10:00:00.000Z',
  publicUrl: null,
};
const requested: RequestedUploadDto = {
  asset,
  upload: {
    method: 'PUT',
    url: 'https://store.test/signed',
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=1' },
    expiresAt: '2026-10-18T10:05:00.000Z',
  },
};
const file = Object.assign(new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }), {
  name: 'a.png',
});
const failure = (code: string): ActionResult<never> => ({
  ok: false,
  error: { code, message: 'x' },
});

const requestOk = async (): Promise<ActionResult<RequestedUploadDto>> => ({
  ok: true,
  data: requested,
});
const completeOk = async (): Promise<ActionResult<MediaAssetDto>> => ({
  ok: true,
  data: { ...asset, status: 'ready' },
});

function uploader(overrides: Partial<Parameters<typeof createMediaUploader>[0]> = {}) {
  const calls: string[] = [];
  const deps: Parameters<typeof createMediaUploader>[0] = {
    request: vi.fn(async () => {
      calls.push('request');
      return requestOk();
    }),
    send: vi.fn(async () => {
      calls.push('send');
      return new Response(null, { status: 200 });
    }),
    complete: vi.fn(async () => {
      calls.push('complete');
      return completeOk();
    }),
    ...overrides,
  };
  return { upload: createMediaUploader(deps), deps, calls };
}

describe('the browser uploader', () => {
  it('asks, then sends straight to the store, then confirms, in that order', async () => {
    const { upload, calls } = uploader();
    const outcome = await upload(WEBSITE_ID, file);

    expect(calls).toEqual(['request', 'send', 'complete']);
    expect(outcome).toMatchObject({ ok: true, asset: { status: 'ready' } });
  });

  it('names the website and the file, and sends exactly the signed headers and the body', async () => {
    const { upload, deps } = uploader();
    await upload(WEBSITE_ID, file, 'private');

    expect(deps.request).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      fileName: 'a.png',
      contentType: 'image/png',
      byteSize: 4,
      visibility: 'private',
    });
    expect(deps.send).toHaveBeenCalledWith('https://store.test/signed', {
      method: 'PUT',
      headers: requested.upload.headers,
      body: file,
    });
    expect(deps.complete).toHaveBeenCalledWith({ websiteId: WEBSITE_ID, id: asset.id });
  });

  it('stops at a refused request and sends nothing', async () => {
    const { upload, deps } = uploader({
      request: vi.fn(async () => failure('media.validation_failed')),
    });
    const outcome = await upload(WEBSITE_ID, file);

    expect(outcome).toMatchObject({
      ok: false,
      stage: 'request',
      error: { code: 'media.validation_failed' },
    });
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.complete).not.toHaveBeenCalled();
  });

  it.each([
    ['refuses the file', async () => new Response(null, { status: 403 })],
    ['cannot be reached', async () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('stops when the store %s, and never claims success', async (_label, send) => {
    const { upload, deps } = uploader({ send: vi.fn(send) });
    const outcome = await upload(WEBSITE_ID, file);

    expect(outcome).toMatchObject({
      ok: false,
      stage: 'transfer',
      error: { code: TRANSFER_FAILED_CODE },
    });
    expect(deps.complete).not.toHaveBeenCalled();
  });

  it('reports a refused confirmation as such, so only that step is retried', async () => {
    const { upload } = uploader({ complete: vi.fn(async () => failure('media.upload_rejected')) });
    expect(await upload(WEBSITE_ID, file)).toMatchObject({
      ok: false,
      stage: 'complete',
      error: { code: 'media.upload_rejected' },
    });
  });
});
