import { builderRoutes } from '@modules/builder/client';
import { releaseRoutes } from '@modules/release/client';

import { PageHeading } from '@components/layout/layout-primitives';
import { Badge } from '@components/ui/badge';
import { buttonVariants } from '@components/ui/button';
import { ExternalLink } from '@components/ui/icons';

import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { loadWebsite } from '@/app/_lib/load-website';
import { orFail } from '@/app/_lib/or-fail';
import { loadPublicationStatus } from '@/app/_lib/publication-status';
import { getWebsiteAccess } from '@/app/_lib/website-access';

import type { BlockProps } from './block-props';

/** The name, where it is served and whether it is live, with the two things done most: look at it, edit it. */
export async function OverviewHeader({ websiteId, locale }: BlockProps) {
  const [access, website, t] = await Promise.all([
    getWebsiteAccess(),
    orFail(loadWebsite(websiteId)),
    getTranslations({ locale, namespace: 'website' }),
  ]);
  const status = access.may('release.read') ? await orFail(loadPublicationStatus(websiteId)) : null;
  const isLive = (status?.live ?? null) !== null;

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <PageHeading title={website.name} description={website.description ?? undefined} />
        {status !== null && (
          <p className="flex items-center gap-2 text-sm text-copy-muted">
            <span>{website.slug}</span>
            <Badge variant={isLive ? 'success' : 'muted'}>
              {isLive ? t('pages.detail.live') : t('pages.detail.notPublished')}
            </Badge>
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {isLive && (
          <Link
            href={releaseRoutes.publicSite(website.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline' })}
          >
            {t('pages.detail.viewSite')}
            <ExternalLink className="size-4" aria-hidden="true" />
          </Link>
        )}
        {access.maySection('builder') && (
          <Link href={builderRoutes.pages(websiteId)} className={buttonVariants()}>
            {t('pages.detail.editSite')}
          </Link>
        )}
      </div>
    </header>
  );
}
