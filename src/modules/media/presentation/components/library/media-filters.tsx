import { FilterBar, FilterChips, FilterSearchField } from '@components/shared/filter-bar';

import { getTranslations } from '@i18n/server';

import { formatSort } from '@lib/pagination';
import type { SortSpec } from '@lib/pagination';

import {
  DEFAULT_MEDIA_SORT,
  MEDIA_VISIBILITIES,
} from '../../../application/contracts/media-constraints';

import type {
  MediaSortField,
  MediaVisibility,
} from '../../../application/contracts/media-constraints';

const VISIBILITY_KEYS = {
  public: 'library.visibility.public',
  private: 'library.visibility.private',
} as const satisfies Record<MediaVisibility, string>;

interface MediaFiltersProps {
  readonly pathname: string;
  readonly text: string | null;
  readonly visibility: MediaVisibility | null;
  readonly sort: SortSpec<MediaSortField>;
  readonly visibilityHref: (visibility: MediaVisibility | null) => string;
  readonly resetHref: string;
}

/**
 * The library's toolbar: quick filters by visibility, then the search by file name. Both live in
 * the address, so a filtered library can be shared and needs no script; each keeps the other and
 * the sort.
 */
export async function MediaFilters({
  pathname,
  text,
  visibility,
  sort,
  visibilityHref,
  resetHref,
}: MediaFiltersProps) {
  const t = await getTranslations('media');

  return (
    <div className="divide-y divide-border border-b border-border">
      <div className="px-4 py-3">
        <FilterChips
          label={t('library.filters.visibility')}
          chips={[null, ...MEDIA_VISIBILITIES].map((choice) => ({
            key: choice ?? 'all',
            href: visibilityHref(choice),
            isActive: choice === visibility,
            label: t(choice === null ? 'library.filters.all' : VISIBILITY_KEYS[choice]),
          }))}
        />
      </div>
      {/* Keyed by the applied search: links change it without a reload, and the field only reads its start value. */}
      <FilterBar
        key={JSON.stringify({ text, visibility, sort })}
        action={pathname}
        label={t('library.filters.label')}
        applyLabel={t('library.filters.apply')}
        resetLabel={t('library.filters.reset')}
        resetHref={resetHref}
        className="px-4 py-3"
      >
        <FilterSearchField
          id="media-q"
          name="q"
          label={t('library.filters.search')}
          defaultValue={text ?? ''}
          placeholder={t('library.filters.search')}
        />
        {visibility !== null && <input type="hidden" name="visibility" value={visibility} />}
        {formatSort(sort) !== formatSort(DEFAULT_MEDIA_SORT) && (
          <input type="hidden" name="sort" value={formatSort(sort)} />
        )}
      </FilterBar>
    </div>
  );
}
