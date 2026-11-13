import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getBookingQueries } from '../../../composition';
import { loadTeamMember } from '../../loaders/load-team-administration';
import { bookingRoutes } from '../../routes';
import { BookingAdminPage } from '../shared/booking-admin-page';

import { TeamMemberActions } from './team-member-actions.client';
import { TeamMemberForm } from './team-member-form.client';

export interface TeamMemberAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly locationId: string;
  readonly employeeId: string;
}

/** One employee's calendar, as a manager edits it. */
export async function TeamMemberAdministration({
  locale,
  websiteId,
  locationId,
  employeeId,
}: TeamMemberAdministrationProps) {
  const [t, member] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadTeamMember({ websiteId, locationId, employeeId }, getBookingQueries()),
  ]);
  const teamHref = bookingRoutes.locationTeam(websiteId, locationId);

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      scope={{ area: 'team', locationId, locationName: member.location.name }}
      crumbs={[{ label: member.name }]}
      title={member.name}
      description={t('team.member.subtitle', { location: member.location.name })}
      actions={
        <TeamMemberActions
          moveTargets={member.coverageChoices}
          subject={{
            websiteId,
            id: member.id,
            name: member.name,
            version: member.version,
            locationId,
          }}
        />
      }
      unsavedBody={t('team.form.unsavedBody')}
    >
      <TeamMemberForm mode="manager" member={member} savedHref={teamHref} cancelHref={teamHref} />
    </BookingAdminPage>
  );
}
