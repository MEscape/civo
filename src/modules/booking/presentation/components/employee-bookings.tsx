import { notFound } from 'next/navigation';

import { I18nProvider } from '@components/providers/i18n-provider';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import type { AppError } from '@lib/errors';
import { escalate } from '@lib/errors/escalate';

import { bookingAdminQueries } from '../../composition';
import { toResourceDto } from '../dto/setup-dto';
import { upcomingRange } from '../time/upcoming-range';

import { OwnHoursForm } from './admin/own-hours-form.client';

const UPCOMING_DAYS = 14;

export interface EmployeeBookingsProps {
  readonly websiteId: string;
  readonly locale: Locale;
}

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
 * What an employee sees of the booking system: the next two weeks of the
 * calendars assigned to them, and the form for their working hours where an
 * editor allowed it. The calendar query filters to the employee's resources
 * on the server; nothing here widens it.
 */
export async function EmployeeBookings({ websiteId, locale }: EmployeeBookingsProps) {
  const range = upcomingRange(UPCOMING_DAYS);
  const [own, calendar, t, formats] = await Promise.all([
    bookingAdminQueries.getOwnResources.execute(websiteId),
    bookingAdminQueries.getOperationsCalendar.execute({
      websiteId,
      ...range,
    }),
    getTranslations({ locale, namespace: 'booking' }),
    getAppFormatters(),
  ]);

  if (own.isErr()) {
    failOrNotFound(own.error);
  }
  if (own.value.length === 0) {
    return <p className="text-sm text-copy-muted">{t('own.noCalendars')}</p>;
  }
  if (calendar.isErr()) {
    failOrNotFound(calendar.error);
  }
  const editable = own.value.filter((resource) => resource.employeeMayEditHours);

  return (
    <I18nProvider locale={locale} namespaces={['booking']}>
      <div className="space-y-10">
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

        <section aria-labelledby="own-hours" className="space-y-6">
          <h2 id="own-hours" className="text-lg font-semibold text-copy">
            {t('own.hoursTitle')}
          </h2>
          {own.value
            .filter((resource) => !resource.employeeMayEditHours)
            .map((resource) => (
              <p key={resource.id} className="text-sm text-copy-muted">
                {t('own.hoursLocked', { name: resource.name })}
              </p>
            ))}
          {editable.map((resource) => (
            <OwnHoursForm key={resource.id} resource={toResourceDto(resource)} />
          ))}
        </section>
      </div>
    </I18nProvider>
  );
}
