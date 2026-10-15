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
    <nav aria-label={t('toolbar.breadcrumb')}>
      <ol className="flex items-center gap-2 text-sm">
        <li>
          <Link href={pagesHref} className="text-copy-muted hover:underline">
            {t('toolbar.pages')}
          </Link>
        </li>
        <li aria-hidden="true" className="text-border">
          /
        </li>
        <li aria-current="page" className="font-medium text-copy">
          {pageTitle}
        </li>
      </ol>
    </nav>
  );
}
