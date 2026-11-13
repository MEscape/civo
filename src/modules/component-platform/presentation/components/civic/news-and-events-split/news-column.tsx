import type { ReactNode } from 'react';

import { ClampedText } from '@components/shared/page-parts.client';

import { stripHtml, trimToNull } from '@lib/utils';

import { NewsCard } from '../../shared/news-card';

import { SplitColumn } from './split-column';
import { SplitList } from './split-list';

import type { ContentListView } from '../../../../application/contracts/content-views';

export interface NewsColumnProps {
  readonly heading: string;
  /** What replaces the list while its source is unavailable. */
  readonly unavailableText: string;
  /** What replaces the list when the source is empty. */
  readonly emptyText: string;
  readonly showMoreLabel: string;
  readonly showLessLabel: string;
  /** `null`: the source failed. */
  readonly list: ContentListView<'NewsItem'> | null;
  readonly badge?: ReactNode;
  readonly formatDay?: ((instant: string) => string) | undefined;
}

/** The news half of the split. A failing source degrades this column only. */
export function NewsColumn({
  heading,
  unavailableText,
  emptyText,
  showMoreLabel,
  showLessLabel,
  list,
  badge,
  formatDay,
}: NewsColumnProps) {
  return (
    <SplitColumn heading={heading} badge={badge}>
      {list !== null && list.items.length > 0 ? (
        <SplitList>
          {list.items.map((item) => {
            const rawText = item.excerpt ?? item.content;
            const description =
              rawText !== undefined ? (trimToNull(stripHtml(rawText)) ?? undefined) : undefined;

            return (
              <li key={item.id}>
                <NewsCard
                  item={item}
                  dateLabel={formatDay?.(item.publishedAt)}
                  description={
                    description !== undefined ? (
                      <ClampedText
                        text={description}
                        showMoreLabel={showMoreLabel}
                        showLessLabel={showLessLabel}
                        className="text-sm text-copy-muted"
                      />
                    ) : undefined
                  }
                />
              </li>
            );
          })}
        </SplitList>
      ) : (
        <p className="text-sm text-copy-muted">{list === null ? unavailableText : emptyText}</p>
      )}
    </SplitColumn>
  );
}
