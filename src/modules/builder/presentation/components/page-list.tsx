import { EmptyState } from '@components/layout/layout-primitives';
import { Card, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

import { Link } from '@i18n';

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
          <Card>
            <CardHeader>
              <CardTitle>
                <Link href={builderRoutes.editor(websiteId, page.id)}>{page.title}</Link>
              </CardTitle>
              <CardDescription>
                {page.path === HOME_PAGE_PATH ? t('pages.list.homePage') : `/${page.path}`}
              </CardDescription>
            </CardHeader>
          </Card>
        </li>
      ))}
    </ul>
  );
}
