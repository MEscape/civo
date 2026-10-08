import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

export interface ToolbarBreadcrumbProps {
  readonly websiteName: string;
  readonly pageTitle: string;
  readonly websitesHref: string;
}

export function ToolbarBreadcrumb({
  websiteName,
  pageTitle,
  websitesHref,
}: ToolbarBreadcrumbProps) {
  const t = useTranslations('builder');
  return (
    <nav aria-label={t('toolbar.breadcrumb')}>
      <ol className="flex items-center gap-2 text-sm">
        <li>
          <Link href={websitesHref} className="text-copy-muted hover:underline">
            {t('toolbar.websites')}
          </Link>
        </li>
        <li aria-hidden="true" className="text-border">
          /
        </li>
        <li className="font-medium text-copy">{websiteName}</li>
        <li aria-hidden="true" className="text-border">
          /
        </li>
        <li aria-current="page" className="text-copy-muted">
          {pageTitle}
        </li>
      </ol>
    </nav>
  );
}
