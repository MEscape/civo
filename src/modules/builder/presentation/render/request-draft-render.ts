import type { ReactNode } from 'react';

import { renderDraftPageAction } from '../actions/render-draft-page-action';
import { CLIENT_ERROR_CODES } from '../messages/message-keys';

import type { PageConfigInput } from '../../application/contracts/page-views';

export type DraftRenderOutcome =
  | { readonly ok: true; readonly node: ReactNode }
  | { readonly ok: false; readonly errorCode: string };

/**
 * One server round trip for a draft, as a value: the canvas and the
 * component preview both render through here, so the failure mapping
 * lives once. The element tree travels through the RSC payload.
 */
export async function requestDraftRender(
  pageId: string,
  children: PageConfigInput['children'],
): Promise<DraftRenderOutcome> {
  try {
    const result = await renderDraftPageAction({
      pageId,
      config: { type: 'page', children },
    });
    return result.ok
      ? { ok: true, node: result.data }
      : { ok: false, errorCode: result.error.code };
  } catch {
    // A rejected Server Action means the request never completed.
    return { ok: false, errorCode: CLIENT_ERROR_CODES.networkFailed };
  }
}
