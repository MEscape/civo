import { isJsonRecord } from '@lib/utils';

import { HOME_PAGE_PATH } from '../contracts/builder-constraints';

interface StoredPage {
  readonly path: string;
  readonly config: unknown;
}

/** Whether a stored page tree places the booking component anywhere, at any depth. */
function holdsBooking(node: unknown): boolean {
  if (!isJsonRecord(node)) {
    return false;
  }
  const children = node['children'];
  return (
    node['type'] === 'booking' ||
    (Array.isArray(children) && children.some((child: unknown) => holdsBooking(child)))
  );
}

/**
 * Where the booking is, for a link in an e-mail that names the website and not a page: the page
 * asked for when it holds the booking, else the home page, else the first page that does, else
 * nowhere (`null`: the editor never placed one).
 */
export function findBookingPagePath(
  pages: readonly StoredPage[],
  currentPath: string,
): string | null {
  const holders = pages.filter((page) => holdsBooking(page.config));
  const preferred =
    holders.find((page) => page.path === currentPath) ??
    holders.find((page) => page.path === HOME_PAGE_PATH) ??
    holders[0];
  return preferred?.path ?? null;
}
