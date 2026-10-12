import { setPath } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

import type { PageRequest } from './pagination-strategy';

export type RequestBody = Readonly<Record<string, JsonValue>>;

/** One outgoing request: where to, and the JSON body of a POST (`null`: none). */
export interface OutgoingRequest {
  readonly url: URL;
  readonly body: RequestBody | null;
}

/**
 * Turns the endpoint and the page to ask for into the request to send, or
 * `null` when the page's URL leaves the configured origin. Following a link
 * the API supplies is the one place a response names where the next request
 * goes, so it must stay on the origin the administrator configured and the
 * SSRF policy already approved.
 */
export function buildRequest(
  endpoint: URL,
  requestBody: RequestBody | null,
  page: PageRequest | null,
): OutgoingRequest | null {
  if (page === null) {
    return { url: endpoint, body: requestBody };
  }

  if (page.kind === 'url') {
    let target: URL;
    try {
      target = new URL(page.url, endpoint);
    } catch {
      return null;
    }
    return target.origin === endpoint.origin ? { url: target, body: requestBody } : null;
  }

  if (page.placement === 'query') {
    const url = new URL(endpoint);
    for (const [name, value] of Object.entries(page.params)) {
      url.searchParams.set(name, String(value));
    }
    return { url, body: requestBody };
  }

  let body: Record<string, JsonValue> = { ...requestBody };
  for (const [name, value] of Object.entries(page.params)) {
    body = setPath(body, name, value);
  }
  return { url: endpoint, body };
}
