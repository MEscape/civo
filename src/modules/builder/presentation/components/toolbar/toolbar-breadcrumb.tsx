import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@components/ui/breadcrumb';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

export interface ToolbarBreadcrumbProps {
  readonly pageTitle: string;
  readonly pagesHref: string;
}

/** Where the page sits: the website's name and sections are the bar above the editor, so only the page list and the page are named here. */
export function ToolbarBreadcrumb({ pageTitle, pagesHref }: ToolbarBreadcrumbProps) {
  const t = useTranslations('builder');

  return (
    <Breadcrumb aria-label={t('toolbar.breadcrumb')} className="min-w-0">
      <BreadcrumbList className="flex-nowrap gap-2">
        <BreadcrumbItem className="shrink-0">
          <BreadcrumbLink asChild>
            <Link href={pagesHref}>{t('toolbar.pages')}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
