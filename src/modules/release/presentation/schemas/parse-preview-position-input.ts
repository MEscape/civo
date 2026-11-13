import { resolvePageRequest } from '@lib/pagination';

import { RELEASE_HISTORY_PAGE_LIMITS } from '../../application/contracts/release-constraints';

type RawParams = Readonly<Record<string, string | string[] | undefined>>;

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The history slice a preview came from, bounded exactly like the release list. */
export function parsePreviewPosition(raw: RawParams) {
  return resolvePageRequest(
    { page: firstOf(raw['from']), pageSize: firstOf(raw['fromPageSize']) },
    RELEASE_HISTORY_PAGE_LIMITS,
  );
}

/** The page of the release asked for (empty for the home page; `undefined` for the first one) and where the preview came from. */
export function parsePreviewParams(raw: RawParams) {
  return { path: firstOf(raw['path']), from: parsePreviewPosition(raw) };
}
