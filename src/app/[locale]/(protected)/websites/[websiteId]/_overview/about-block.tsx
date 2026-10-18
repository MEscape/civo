import { releaseRoutes } from '@modules/release/client';
import { WebsiteAboutCard } from '@modules/website';

import type { Locale } from '@i18n';

import { publicEnv } from '@lib/config';

import { loadDataSources } from '@/app/_lib/data-source-count';
import { loadWebsite } from '@/app/_lib/load-website';
import { orFail } from '@/app/_lib/or-fail';
import { loadPublicationStatus } from '@/app/_lib/publication-status';
import { getWebsiteAccess } from '@/app/_lib/website-access';

import type { BlockProps } from './block-props';

/** The full address a visitor types, for the copy button. */
function publicUrlOf(locale: Locale, slug: string): string {
  const path = releaseRoutes.publicSite(slug).replace(/^\//, '');
  return new URL(`/${locale}/${path}`, publicEnv.NEXT_PUBLIC_APP_URL).href;
}

export async function AboutBlock({ websiteId, locale }: BlockProps) {
  const access = await getWebsiteAccess();
  const [website, status, sources] = await Promise.all([
    orFail(loadWebsite(websiteId)),
    access.may('release.read') ? orFail(loadPublicationStatus(websiteId)) : null,
    access.may('datasource.read') ? orFail(loadDataSources(websiteId)) : null,
  ]);
  const isLive = (status?.live ?? null) !== null;

  return (
    <WebsiteAboutCard
      locale={locale}
      website={website}
      publicHref={isLive ? releaseRoutes.publicSite(website.slug) : null}
      publicUrl={isLive ? publicUrlOf(locale, website.slug) : null}
      pageCount={status?.draft.pageCount ?? null}
      dataSourceCount={sources?.length ?? null}
    />
  );
}
