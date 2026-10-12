import { EmptyState } from '@components/layout/layout-primitives';
import { LinkCard } from '@components/shared/link-card';

import { useTranslations } from '@i18n/client';

import { HOME_PAGE_PATH } from '../../application/contracts/builder-constraints';
import { builderRoutes } from '../routes';

import type { PageSummaryDto } from '../dto/page-dto';

export interface PageListProps {
  readonly websiteId: string;
  readonly pages: readonly PageSummaryDto[];
}

/** The pages of one website, each linking to its editor. A Server Component. */
export function PageList({ websiteId, pages }: PageListProps) {
  const t = useTranslations('builder');

  if (pages.length === 0) {
    return (
      <EmptyState title={t('pages.list.empty')} description={t('pages.list.emptyDescription')} />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2" aria-label={t('pages.list.label')}>
      {pages.map((page) => (
        <li key={page.id}>
          <LinkCard
            href={builderRoutes.editor(websiteId, page.id)}
            title={page.title}
            description={page.path === HOME_PAGE_PATH ? t('pages.list.homePage') : `/${page.path}`}
          />
        </li>
      ))}
    </ul>
  );
}
