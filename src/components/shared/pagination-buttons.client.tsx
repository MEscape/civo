'use client';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { PAGER_FOCUS, PAGER_ITEM, visiblePages } from './pagination-parts';

export interface PaginationButtonsProps {
  readonly page: number;
  readonly pageCount: number;
  readonly onPage: (page: number) => void;
  /** Names the landmark, e.g. "Pages of exceptions". */
  readonly label: string;
}

/**
 * The pager of `Pagination` for a list that is held in a form and not in the address (the exceptions
 * of a location, of a resource, of an employee): the same steps and numbered pages, with the same look,
 * as buttons. Renders nothing for a single page.
 */
export function PaginationButtons({ page, pageCount, onPage, label }: PaginationButtonsProps) {
  const t = useTranslations('app');
  if (pageCount <= 1) {
    return null;
  }
  const step = (target: number, text: string, isEnabled: boolean) => (
    <button
      type="button"
      disabled={!isEnabled}
      onClick={() => {
        onPage(target);
      }}
      className={cn(PAGER_ITEM, PAGER_FOCUS, isEnabled ? 'hover:bg-canvas' : 'opacity-50')}
    >
      {text}
    </button>
  );

  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap items-center gap-1">
        <li>{step(page - 1, t('pagination.previous'), page > 1)}</li>
        {visiblePages(page, pageCount).map((entry, index) =>
          entry === null ? (
            <li key={`gap-${String(index)}`} aria-hidden="true" className="px-1 text-copy-muted">
              …
            </li>
          ) : (
            <li key={entry}>
              <button
                type="button"
                aria-label={t('pagination.page', { page: entry })}
                aria-current={entry === page ? 'page' : undefined}
                onClick={() => {
                  onPage(entry);
                }}
                className={cn(
                  PAGER_ITEM,
                  PAGER_FOCUS,
                  entry === page
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-canvas',
                )}
              >
                {entry}
              </button>
            </li>
          ),
        )}
        <li>{step(page + 1, t('pagination.next'), page < pageCount)}</li>
      </ul>
    </nav>
  );
}
