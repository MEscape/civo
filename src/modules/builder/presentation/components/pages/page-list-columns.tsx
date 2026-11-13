import { ArrowRight } from '@components/icons/icons';
import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { Badge } from '@components/ui/badge';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { HOME_PAGE_PATH } from '../../../application/contracts/builder-constraints';
import { builderRoutes } from '../../routes';

import { PageOutline } from './page-outline';

import type { PageListItemDto } from '../../dto/page-dto';
import type { AppFormatters, BuilderTranslator } from '../../translation/translator';

interface PageListColumnsInput {
  readonly t: BuilderTranslator;
  readonly format: AppFormatters;
  readonly websiteId: string;
}

/**
 * The columns of the page list: the page itself with a small sketch of its blocks, when it was
 * last saved, and the way into the editor. Whether a person may edit at all was decided by the
 * screen; the server authorizes the editor again.
 */
export function pageListColumns({
  t,
  format,
  websiteId,
}: PageListColumnsInput): ReadonlyArray<ResponsiveColumn<PageListItemDto>> {
  return [
    {
      id: 'page',
      label: t('pages.list.columns.page'),
      cell: (page) => (
        <div className="flex items-center gap-3">
          <PageOutline outline={page.outline} />
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href={builderRoutes.editor(websiteId, page.id)}
                className="truncate rounded-token-sm font-medium text-primary-copy underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
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
          </div>
        </div>
      ),
    },
    {
      id: 'saved',
      label: t('pages.list.columns.saved'),
      cell: (page) => (
        <div className="space-y-0.5 text-sm">
          <time dateTime={page.updatedAt} className="text-copy">
            {format.dateTime(page.updatedAt)}
          </time>
          <p className="text-xs text-copy-muted">
            {t('pages.list.version', { version: page.version })}
          </p>
        </div>
      ),
    },
    {
      id: 'actions',
      label: t('pages.list.columns.actions'),
      isAction: true,
      cell: (page) => (
        <div className="flex justify-end gap-1">
          <Link
            href={builderRoutes.editor(websiteId, page.id)}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            {t('pages.list.open')}
            <span className="sr-only"> {page.title}</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      ),
    },
  ];
}
