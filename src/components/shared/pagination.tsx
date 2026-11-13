import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { offsetOf } from '@lib/pagination';
import type { Page } from '@lib/pagination';
import { cn } from '@lib/utils';

import { PAGER_FOCUS, PAGER_ITEM, visiblePages } from './pagination-parts';

export interface PaginationProps {
  /** The URL's locale: a page prerenders on its own, so it must not be read from the request. */
  readonly locale: Locale;
  /** The slice of the list on screen. */
  readonly slice: Page<unknown>;
  /** The address of a page, keeping the list's filters. */
  readonly hrefFor: (page: number) => string;
  /** Names the landmark, e.g. "Users pages": several lists can share a screen. */
  readonly label: string;
}

interface StepProps {
  readonly rel: 'prev' | 'next';
  /** `undefined` at the end of the list: there is nowhere to go, so there is no link. */
  readonly href: string | undefined;
  readonly label: string;
}

/** Previous or next: a link, or at the end of the list plain text that is out of the tab order. */
function Step({ rel, href, label }: StepProps) {
  if (href === undefined) {
    return (
      <span aria-disabled="true" className={cn(PAGER_ITEM, 'opacity-50')}>
        {label}
      </span>
    );
  }
  return (
    <Link href={href} rel={rel} className={cn(PAGER_ITEM, PAGER_FOCUS, 'hover:bg-canvas')}>
      {label}
    </Link>
  );
}

/**
 * Previous / next and the pages around the current one, as plain links: the
 * state is the address, so a page can be bookmarked, shared and reached
 * without script. "26–50 of 120" is taken from the slice itself. Renders
 * nothing for a single page. Used by every list that paginates; filters are
 * the caller's, through `hrefFor`.
 */
export async function Pagination({ locale, slice, hrefFor, label }: PaginationProps) {
  const { page, pageCount } = slice;
  if (pageCount <= 1) {
    return null;
  }

  const t = await getTranslations({ locale, namespace: 'app' });
  const first = offsetOf(slice) + 1;

  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-copy-muted">
        {t('pagination.summary', {
          first,
          last: first + slice.items.length - 1,
          total: slice.total,
        })}
      </p>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <Step
            rel="prev"
            href={page > 1 ? hrefFor(page - 1) : undefined}
            label={t('pagination.previous')}
          />
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
                aria-label={t('pagination.page', { page: entry })}
                aria-current={entry === page ? 'page' : undefined}
                className={cn(
                  PAGER_ITEM,
                  PAGER_FOCUS,
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
          <Step
            rel="next"
            href={page < pageCount ? hrefFor(page + 1) : undefined}
            label={t('pagination.next')}
          />
        </li>
      </ul>
    </nav>
  );
}
