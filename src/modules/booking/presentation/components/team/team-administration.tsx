import { Alert } from '@components/ui/alert';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getBookingQueries } from '../../../composition';
import { parseTeamListParams, teamSlice } from '../../forms/team-list';
import { loadTeamAdministration } from '../../loaders/load-team-administration';
import { BookingAdminPage } from '../shared/booking-admin-page';

import { TeamList } from './team-list';
import { TeamSetUpButton } from './team-set-up-button.client';
import { TeamVisitors } from './team-visitors';

import type { RawSearchParams } from '../../loaders/booking-readers';

export interface TeamAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly locationId: string;
  /** The address's query: the filters and the page, read without trusting them. */
  readonly searchParams: RawSearchParams;
  /** Where the website's members and their roles are managed; absent for someone who may not open it. */
  readonly usersHref?: string | undefined;
}

/** The calendars of one location, and the members who could be given one. */
export async function TeamAdministration({
  locale,
  websiteId,
  locationId,
  searchParams,
  usersHref,
}: TeamAdministrationProps) {
  const [t, team] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadTeamAdministration({ websiteId, locationId }, getBookingQueries()),
  ]);

  const { view, page } = parseTeamListParams(searchParams);
  const slice = teamSlice(team.members, view, page);

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      scope={{ area: 'team', locationId, locationName: team.location.name, isList: true }}
      title={t('team.titleAt', { location: team.location.name })}
      description={t('team.description')}
      actions={
        team.candidates.length > 0 ? (
          <TeamSetUpButton
            websiteId={websiteId}
            location={team.location}
            candidates={team.candidates}
          />
        ) : undefined
      }
    >
      <div className="space-y-6">
        {team.isTruncated && (
          <Alert variant="warning" role="status">
            {t('team.truncated')}
          </Alert>
        )}
        <TeamList
          locale={locale}
          websiteId={websiteId}
          location={team.location}
          page={slice.page}
          view={view}
          qualifications={slice.qualifications}
          candidateCount={team.candidates.length}
          moveTargets={team.moveTargets}
          usersHref={usersHref}
        />
        <TeamVisitors locale={locale} websiteId={websiteId} visitors={team.visitors} />
      </div>
    </BookingAdminPage>
  );
}
