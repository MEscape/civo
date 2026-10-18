import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { ListPagination } from '@components/shared/list-pagination';
import { Badge } from '@components/ui/badge';
import { ChevronRight } from '@components/ui/icons';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import type { Page as Slice } from '@lib/pagination';
import { buildQueryString } from '@lib/utils';

import { HOME_PAGE_PATH } from '../../application/contracts/builder-constraints';
import { builderRoutes } from '../routes';

import { PageOutline } from './page-outline';

import type { PageListItemDto } from '../dto/page-dto';

export interface PageListProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly pages: Slice<PageListItemDto>;
}

/**
 * One page of a website's pages as rows in the screen's list frame, the
 * release history's look: a small sketch of each page, its title and
 * address, and when it was last saved. The title is the row's one link (its
 * `::after` covers the row). A Server Component.
 */
export async function PageList({ locale, websiteId, pages }: PageListProps) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'builder' }),
    getAppFormatters(),
  ]);

  if (pages.total === 0) {
    return (
      <EmptyState
        variant="outlined"
        className="py-10"
        title={t('pages.list.empty')}
        description={t('pages.list.emptyDescription')}
      />
    );
  }

  const pagination = (
    <ListPagination
      locale={locale}
      slice={pages}
      hrefFor={(target) =>
        `${builderRoutes.pages(websiteId)}${buildQueryString({
          page: target === 1 ? undefined : target,
          pageSize: pages.pageSize,
        })}`
      }
      label={t('pages.list.pagination.nav')}
    />
  );

  return (
    <DataPanel
      title={t('pages.list.label')}
      meta={t('pages.list.count', { count: pages.total })}
      footer={pages.pageCount > 1 ? pagination : undefined}
    >
      <ul className="divide-y divide-border">
        {pages.items.map((page) => {
          const saved = t('pages.list.savedAt', {
            when: format.dateTime(page.updatedAt),
            version: page.version,
          });
          return (
            <li
              key={page.id}
              className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent has-[a:focus-visible]:ring-inset motion-reduce:transition-none"
            >
              <PageOutline outline={page.outline} />
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Link
                    href={builderRoutes.editor(websiteId, page.id)}
                    aria-label={t('pages.list.edit', { title: page.title })}
                    className="truncate text-sm font-medium text-copy after:absolute after:inset-0 focus-visible:outline-none"
                  >
                    {page.title}
                  </Link>
                  {page.path === HOME_PAGE_PATH && (
                    <Badge variant="muted" className="shrink-0">
                      {t('pages.list.homePage')}
                    </Badge>
                  )}
                </div>
                <p className="truncate font-mono text-xs text-copy-muted">/{page.path}</p>
                <p className="text-xs text-copy-muted sm:hidden">{saved}</p>
              </div>
              <p className="hidden shrink-0 text-right text-xs whitespace-nowrap text-copy-muted sm:block">
                {saved}
              </p>
              <ChevronRight className="size-4 shrink-0 text-copy-muted" aria-hidden="true" />
            </li>
          );
        })}
      </ul>
    </DataPanel>
  );
}
