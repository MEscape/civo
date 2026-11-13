import { notFound } from 'next/navigation';

import { AuditOverview } from '@modules/audit';
import { getAuthQueries, loadMemberNames, MemberOverviewTile } from '@modules/auth';
import { BookingOverviewTile } from '@modules/booking';
import { builderRoutes, PagesOverviewTile } from '@modules/builder';
import { DataSourcesOverviewTile } from '@modules/data-sources';
import { MapsOverviewTile } from '@modules/map';
import { MediaOverviewTile } from '@modules/media';
import {
  loadPublicationStatus,
  PublicationBanner,
  ReleaseActivityCard,
  releaseRoutes,
} from '@modules/release';
import type { PublicationStatusView } from '@modules/release';
import { WebsiteOverview as WebsiteOverviewScreen, websiteRoutes } from '@modules/website';

import { I18nProvider } from '@components/providers/i18n-provider';

import { redirect } from '@i18n';
import type { Locale } from '@i18n';

import { orNull } from '@lib/errors/or-null';

import { orFail } from '@/app/_lib/or-fail';
import { getWebsiteAccess } from '@/app/_lib/website-access';

import { OverviewOnboarding } from './overview-onboarding';

interface OverviewProps {
  readonly websiteId: string;
  readonly locale: Locale;
}

/** The people tile: reads the member summary, which the auth module alone knows how to count. */
async function People({ websiteId, locale }: OverviewProps) {
  const summary = await orNull(getAuthQueries().getMemberSummary.execute());
  return summary === null ? null : (
    <MemberOverviewTile
      locale={locale}
      summary={summary}
      usersHref={websiteRoutes.users(websiteId)}
    />
  );
}

async function Activity({
  websiteId,
  locale,
  status,
  linkToReleases,
}: OverviewProps & { readonly status: PublicationStatusView; readonly linkToReleases: boolean }) {
  const authors = await loadMemberNames(status.recent.map((release) => release.publishedBy));
  return (
    <ReleaseActivityCard
      locale={locale}
      websiteId={websiteId}
      status={status}
      linkToReleases={linkToReleases}
      authors={authors}
    />
  );
}

/** Only cross-module composition stays in app; each capability owns its data, wording and presentation. */
export async function WebsiteOverview({ websiteId, locale }: OverviewProps) {
  const access = await getWebsiteAccess();
  if (!access.maySection('overview')) {
    const landing = access.sections(websiteId)[0];
    return landing === undefined ? notFound() : redirect({ href: landing.href, locale });
  }
  const status = access.may('release.read') ? await orFail(loadPublicationStatus(websiteId)) : null;
  const props = { websiteId, locale };
  return (
    <WebsiteOverviewScreen
      {...props}
      isLive={status === null ? null : status.live !== null}
      editHref={access.maySection('builder') ? builderRoutes.pages(websiteId) : null}
      publicSiteHref={releaseRoutes.publicSite}
      sections={{
        publication:
          status === null ? null : (
            <I18nProvider locale={locale} namespaces={['release']}>
              <PublicationBanner
                {...props}
                status={status}
                mayPublish={access.may('release.publish')}
                mayUpdate={access.may('release.publish')}
              />
            </I18nProvider>
          ),
        onboarding: <OverviewOnboarding {...props} />,
        metrics: [
          {
            visible: access.maySection('builder'),
            tile: <PagesOverviewTile key="pages" {...props} />,
          },
          {
            visible: access.maySection('media'),
            tile: <MediaOverviewTile key="media" {...props} />,
          },
          {
            visible: access.maySection('maps'),
            tile: <MapsOverviewTile key="maps" {...props} />,
          },
          {
            visible: access.maySection('data'),
            tile: <DataSourcesOverviewTile key="data" {...props} />,
          },
          {
            visible: access.maySection('bookings'),
            tile: <BookingOverviewTile key="bookings" {...props} />,
          },
          { visible: access.maySection('users'), tile: <People key="people" {...props} /> },
        ]
          .filter(({ visible }) => visible)
          .map(({ tile }) => tile),
        activity: access.maySection('audit') ? (
          <AuditOverview {...props} auditHref={websiteRoutes.audit(websiteId)} />
        ) : null,
        releases:
          status === null ? null : (
            <Activity {...props} status={status} linkToReleases={access.maySection('releases')} />
          ),
      }}
    />
  );
}
