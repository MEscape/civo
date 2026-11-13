import { ExternalLink } from '@components/icons/icons';
import { AdminPageHeader } from '@components/layout/admin-page';
import { Badge } from '@components/ui/badge';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import type { WebsiteView } from '../../../application/contracts/website-views';

/** Website identity and its primary actions; publication facts come from the owning module. */
export async function WebsiteOverviewHeader({
  website,
  locale,
  isLive,
  publicHref,
  editHref,
}: {
  readonly website: WebsiteView;
  readonly locale: Locale;
  readonly isLive: boolean | null;
  readonly publicHref: string | null;
  readonly editHref: string | null;
}) {
  const t = await getTranslations({ locale, namespace: 'website' });
  return (
    <AdminPageHeader
      title={website.name}
      description={website.description ?? undefined}
      meta={
        isLive !== null && (
          <p className="flex items-center gap-2 text-sm text-copy-muted">
            <code className="text-xs">/{website.slug}</code>
            <Badge variant={isLive ? 'success' : 'muted'}>
              {isLive ? t('pages.detail.live') : t('pages.detail.notPublished')}
            </Badge>
          </p>
        )
      }
      actions={
        <>
          {publicHref !== null && (
            <Link
              href={publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline' })}
            >
              {t('pages.detail.viewSite')}
              <ExternalLink className="size-4" aria-hidden="true" />
            </Link>
          )}
          {editHref !== null && (
            <Link href={editHref} className={buttonVariants()}>
              {t('pages.detail.editSite')}
            </Link>
          )}
        </>
      }
    />
  );
}
