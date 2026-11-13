import { LinkTabs } from '@components/shared/filter-bar';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { orNotFound } from '@lib/errors/or-not-found';

import { loadPublicationStatus } from '../../../composition';
import { releaseRoutes } from '../../routes';

export interface ReleaseTabsProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly tab: 'releases' | 'updates';
  /** The components a newer version can replace; counted in the tab's name when there are some. */
  readonly updatesAvailable?: number;
}

/** The two parts of the release screen as address-backed tabs: they work without script and can be linked. */
export async function ReleaseTabs({
  locale,
  websiteId,
  tab,
  updatesAvailable = 0,
}: ReleaseTabsProps) {
  const t = await getTranslations({ locale, namespace: 'release' });

  return (
    <LinkTabs
      label={t('pages.releases.tabs.label')}
      activeKey={tab}
      tabs={[
        {
          key: 'releases',
          label: t('pages.releases.tabs.releases'),
          href: releaseRoutes.releases(websiteId),
        },
        {
          key: 'updates',
          label:
            updatesAvailable > 0
              ? t('pages.releases.tabs.updatesCount', { count: updatesAvailable })
              : t('pages.releases.tabs.updates'),
          href: releaseRoutes.updates(websiteId),
        },
      ]}
    />
  );
}

/**
 * The tabs with the number of updates waiting. The update state is a heavier read than the
 * history, so this streams in beside the content instead of holding it back.
 */
export async function ReleaseTabsWithCount(props: Omit<ReleaseTabsProps, 'updatesAvailable'>) {
  const status = await orNotFound(loadPublicationStatus(props.websiteId));
  return <ReleaseTabs {...props} updatesAvailable={status.componentUpdates?.available ?? 0} />;
}
