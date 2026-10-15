import { notFound } from 'next/navigation';

import { I18nProvider } from '@components/providers/i18n-provider';
import { LinkTabs } from '@components/shared/link-tabs';

import { redirect } from '@i18n';
import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import type { AppError } from '@lib/errors';
import { escalate } from '@lib/errors/escalate';

import { bookingAdminQueries } from '../../composition';
import { toOwnProfileDto } from '../dto/setup-dto';
import { bookingRoutes } from '../routes';
import { upcomingRange } from '../time/upcoming-range';

import { ManagerChangeNotice } from './admin/manager-change-notice.client';
import { OwnProfileForm } from './admin/own-profile-form.client';
import { BookingUnsavedGuard } from './shared/booking-unsaved-guard';

const UPCOMING_DAYS = 14;

export interface EmployeeBookingsProps {
  readonly websiteId: string;
  readonly locale: Locale;
  /** Which part is shown: `calendar` (the upcoming bookings) or `profile` (hours, location, services). */
  readonly tab: string | undefined;
}

const EMPLOYEE_TABS = ['calendar', 'profile'] as const;

const NOT_FOUND_KINDS: ReadonlySet<AppError['kind']> = new Set([
  'forbidden',
  'unauthorized',
  'validation',
  'not_found',
]);

function failOrNotFound(error: AppError): never {
  if (NOT_FOUND_KINDS.has(error.kind)) {
    notFound();
  }
  escalate(error);
}

/**
 * What an employee sees of the booking system: their own place in it (the
 * calendar that is theirs, the hours they work, the services they offer), and
 * their next two weeks. Nothing of the configuration is theirs, and the
 * calendar query narrows to their resource in the store; nothing here widens it.
 */
export async function EmployeeBookings({ websiteId, locale, tab }: EmployeeBookingsProps) {
  const range = upcomingRange(UPCOMING_DAYS);
  const [own, calendar, t, formats] = await Promise.all([
    bookingAdminQueries.getOwnProfile.execute(websiteId),
    bookingAdminQueries.getOperationsCalendar.execute({ websiteId, ...range }),
    getTranslations({ locale, namespace: 'booking' }),
    getAppFormatters(),
  ]);

  if (own.isErr()) {
    failOrNotFound(own.error);
  }
  if (calendar.isErr()) {
    failOrNotFound(calendar.error);
  }

  // Someone who has not set their calendar up yet starts where that is done. The tab is
  // named in the address, so saving does not move them to the other one.
  const shown = EMPLOYEE_TABS.find((candidate) => candidate === tab);
  if (shown === undefined && own.value.profile === null) {
    redirect({ href: `${bookingRoutes.admin(websiteId)}?tab=profile`, locale });
  }

  return (
    <I18nProvider locale={locale} namespaces={['booking']}>
      <BookingUnsavedGuard>
        <div className="space-y-6">
          {own.value.profile?.managerChange && (
            <ManagerChangeNotice websiteId={websiteId} change={own.value.profile.managerChange} />
          )}
          <LinkTabs
            label={t('admin.tabsLabel')}
            activeKey={shown ?? 'calendar'}
            tabs={EMPLOYEE_TABS.map((key) => ({
              key,
              label: t(`own.tabs.${key}`),
              href: `${bookingRoutes.admin(websiteId)}?tab=${key}`,
            }))}
          />
          {shown === 'profile' ? (
            <section aria-labelledby="own-profile" className="space-y-3">
              <h2 id="own-profile" className="text-lg font-semibold text-copy">
                {t('own.profileTitle')}
              </h2>
              <p className="text-sm text-copy-muted">
                {own.value.profile === null ? t('own.profileNew') : t('own.profileIntro')}
              </p>
              <OwnProfileForm websiteId={websiteId} own={toOwnProfileDto(own.value)} />
            </section>
          ) : (
            <section aria-labelledby="own-upcoming" className="space-y-3">
              <h2 id="own-upcoming" className="text-lg font-semibold text-copy">
                {t('own.upcoming')}
              </h2>
              {calendar.value.bookings.length === 0 ? (
                <p className="text-sm text-copy-muted">{t('own.empty')}</p>
              ) : (
                <ul className="divide-y divide-border rounded-token border border-border">
                  {calendar.value.bookings.map((booking) => (
                    <li key={booking.id} className="p-3">
                      <p className="text-sm font-medium text-copy">
                        {formats.dateTime(booking.start)} · {booking.serviceName}
                      </p>
                      <p className="text-xs text-copy-muted">
                        {booking.customerName ?? booking.reference}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </BookingUnsavedGuard>
    </I18nProvider>
  );
}
