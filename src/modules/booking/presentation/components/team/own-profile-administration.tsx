import { UserPlus } from '@components/icons/icons';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getBookingQueries } from '../../../composition';
import { loadOwnProfile } from '../../loaders/load-team-administration';
import { bookingRoutes } from '../../routes';
import { BookingAdminPage } from '../shared/booking-admin-page';
import { BookingEmptyState } from '../shared/booking-empty-state';

import { OwnProfileFacts } from './own-profile-facts';
import { TeamMemberForm } from './team-member-form.client';

export interface OwnProfileAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
}

/** The signed-in employee's own calendar: what a manager changed for them, and the form to change it. */
export async function OwnProfileAdministration({
  locale,
  websiteId,
}: OwnProfileAdministrationProps) {
  const [t, member] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadOwnProfile(websiteId, getBookingQueries()),
  ]);
  const here = bookingRoutes.ownProfile(websiteId);

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      title={t('team.profile.title')}
      description={t('team.profile.description')}
      {...(member === null ? {} : { unsavedBody: t('team.form.unsavedBody') })}
    >
      {member === null ? (
        <BookingEmptyState
          icon={<UserPlus aria-hidden="true" />}
          scope="page"
          title={t('team.profile.notSetUpTitle')}
          description={t('team.profile.notSetUpDescription')}
        />
      ) : (
        <div className="space-y-6">
          <OwnProfileFacts locale={locale} member={member} />
          <TeamMemberForm
            mode="own"
            member={member}
            savedHref={here}
            cancelHref={here}
            preferencesHref={bookingRoutes.mePreferences(websiteId)}
          />
        </div>
      )}
    </BookingAdminPage>
  );
}
