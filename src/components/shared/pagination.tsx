import { Link } from '@i18n';

import { cn } from '@lib/utils';

export interface PaginationLabels {
  /** Names the landmark, e.g. "Users pages". */
  readonly nav: string;
  readonly previous: string;
  readonly next: string;
  /** "26-50 of 120", already formatted. */
  readonly summary: string;
  /** Accessible name of one page link, e.g. "Page 3". */
  readonly pageLabel: (page: number) => string;
}

export interface PaginationProps {
  readonly page: number;
  readonly pageCount: number;
  /** The address of a page, keeping the list's filters. */
  readonly hrefFor: (page: number) => string;
  readonly labels: PaginationLabels;
}

/** Pages to show: the first, the last and the neighbours of the current one; `null` is a gap. */
function visiblePages(page: number, pageCount: number): ReadonlyArray<number | null> {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...wanted].filter((candidate) => candidate >= 1 && candidate <= pageCount);
  pages.sort((a, b) => a - b);

  const items: Array<number | null> = [];
  pages.forEach((candidate, index) => {
    const before = pages[index - 1];
    if (before !== undefined && candidate - before > 1) {
      items.push(null);
    }
    items.push(candidate);
  });
  return items;
}

const LINK =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-token border border-border px-3 text-sm';

/**
 * Previous / next and the pages around the current one, as plain links: the
 * state is the address, so a page can be bookmarked, shared and reached
 * without script. Used by every list that paginates; filters are the
 * caller's, through `hrefFor`.
 */
export function Pagination({ page, pageCount, hrefFor, labels }: PaginationProps) {
  const disabled = 'pointer-events-none opacity-50';

  return (
    <nav aria-label={labels.nav} className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-copy-muted">{labels.summary}</p>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <Link
            href={hrefFor(Math.max(1, page - 1))}
            rel="prev"
            aria-disabled={page <= 1}
            tabIndex={page <= 1 ? -1 : undefined}
            className={cn(LINK, 'hover:bg-canvas', page <= 1 && disabled)}
          >
            {labels.previous}
          </Link>
        </li>
        {visiblePages(page, pageCount).map((entry, index) =>
          entry === null ? (
            // eslint-disable-next-line react/no-array-index-key -- gaps have no identity
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-copy-muted">
              …
            </li>
          ) : (
            <li key={entry}>
              <Link
                href={hrefFor(entry)}
                aria-label={labels.pageLabel(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className={cn(
                  LINK,
                  entry === page
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-canvas',
                )}
              >
                {entry}
              </Link>
            </li>
          ),
        )}
        <li>
          <Link
            href={hrefFor(Math.min(pageCount, page + 1))}
            rel="next"
            aria-disabled={page >= pageCount}
            tabIndex={page >= pageCount ? -1 : undefined}
            className={cn(LINK, 'hover:bg-canvas', page >= pageCount && disabled)}
          >
            {labels.next}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
