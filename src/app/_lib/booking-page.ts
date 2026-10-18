import { restoreStoredPageConfig } from '@modules/builder';

type StoredPages = ReadonlyArray<{ readonly path: string; readonly config: unknown }>;
/** What is read of a page's tree: a node's type, and its children. */
interface TreeNode {
  readonly type: string;
  readonly children: readonly TreeNode[];
}

const BOOKING_TYPE = 'booking';

function holdsBooking(nodes: readonly TreeNode[]): boolean {
  return nodes.some((node) => node.type === BOOKING_TYPE || holdsBooking(node.children));
}

/**
 * The path of the published page that holds the booking, so a link from an
 * e-mail can lead to it wherever the editor put it: the page being asked for
 * when it has one, else the home page, else the first page that does. A
 * component that may appear once on a page can still appear on more than one,
 * so "first" is a rule, not a guess. `null` when no page has a booking; a
 * page whose stored configuration cannot be read is skipped, not trusted.
 */
export function findBookingPagePath(pages: StoredPages, currentPath: string): string | null {
  const holding: string[] = [];
  for (const page of pages) {
    const restored = restoreStoredPageConfig(page.config);
    if (restored.isOk() && holdsBooking(restored.value.children)) {
      holding.push(page.path);
    }
  }
  if (holding.includes(currentPath)) {
    return currentPath;
  }
  return holding.includes('') ? '' : (holding[0] ?? null);
}
