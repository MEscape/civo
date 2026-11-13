import type { ActionResult, SerializedActionError } from '@lib/result';

import { completeMediaUploadAction } from '../actions/complete-media-upload-action';
import { requestMediaUploadAction } from '../actions/request-media-upload-action';
import { TRANSFER_FAILED_CODE } from '../messages/message-keys';

import type { MediaVisibility } from '../../application/contracts/media-constraints';
import type { MediaAssetDto, RequestedUploadDto } from '../dto/media-dto';

type UploadStage = 'request' | 'transfer' | 'complete';

/** What an upload came to. A failure says which step it stopped at, so the UI can tell what is safe to retry. */
type UploadOutcome =
  | { readonly ok: true; readonly asset: MediaAssetDto }
  | { readonly ok: false; readonly stage: UploadStage; readonly error: SerializedActionError };

/** What the uploader needs; replaceable so the flow can be tested without a browser or a server. */
interface MediaUploaderDeps {
  request(input: unknown): Promise<ActionResult<RequestedUploadDto>>;
  complete(input: unknown): Promise<ActionResult<MediaAssetDto>>;
  send(
    url: string,
    init: { method: 'PUT'; headers: Record<string, string>; body: Blob },
  ): Promise<Response>;
}

/** The file as the browser hands it over. */
type UploadableFile = Blob & { readonly name: string };

/**
 * The three steps of an upload, in the only safe order:
 *
 *  1. ask the server for permission (it checks who you are and what the file is),
 *  2. send the file straight to the store with exactly the headers the server signed,
 *  3. tell the server it is done, which then verifies the stored file before believing it.
 *
 * The file never passes through the application server, and the browser never holds a long-lived
 * credential: only the one short-lived permission for this one file. A failure at step 2 needs a
 * new permission (start over); a failure at step 3 may simply be tried again with the same asset.
 */
export function createMediaUploader(deps: MediaUploaderDeps) {
  return async function upload(
    websiteId: string,
    file: UploadableFile,
    visibility: MediaVisibility = 'public',
  ): Promise<UploadOutcome> {
    const requested = await deps.request({
      websiteId,
      fileName: file.name,
      contentType: file.type,
      byteSize: file.size,
      visibility,
    });
    if (!requested.ok) {
      return { ok: false, stage: 'request', error: requested.error };
    }

    const { asset, upload: target } = requested.data;
    const sent = await deps
      .send(target.url, { method: 'PUT', headers: { ...target.headers }, body: file })
      .catch(() => null);
    if (!sent?.ok) {
      return {
        ok: false,
        stage: 'transfer',
        error: { code: TRANSFER_FAILED_CODE, message: 'The file could not be sent to the store.' },
      };
    }

    const completed = await deps.complete({ websiteId, id: asset.id });
    return completed.ok
      ? { ok: true, asset: completed.data }
      : { ok: false, stage: 'complete', error: completed.error };
  };
}

/** The uploader for the browser: the real Server Actions and the real `fetch`. */
export const uploadMediaFile = createMediaUploader({
  request: requestMediaUploadAction,
  complete: completeMediaUploadAction,
  send: (url, init) => fetch(url, init),
});
