import { notFound } from 'next/navigation';

import { I18nProvider } from '@components/providers/i18n-provider';

import type { Locale } from '@i18n';

import type { AppError } from '@lib/errors';
import { escalate } from '@lib/errors/escalate';

import { bookingAdminQueries } from '../../composition';
import { toBookingSetupDto, toEmployeeOptionDto } from '../dto/setup-dto';

import { BookingAdmin } from './admin/booking-admin.client';
import { EmployeeBookings } from './employee-bookings';

import type { EmployeeOptionView } from '../../application/contracts/setup-views';

export interface BookingAdministrationProps {
  readonly websiteId: string;
  /** Who a calendar can be assigned to; empty while nobody holds the employee role. */
  readonly employees: readonly EmployeeOptionView[];
  /** The URL's locale: a page prerenders on its own, so it must not be read from the request. */
  readonly locale: Locale;
}

/** What a person who may not see this page, or asked for nothing valid, is told: it is not there. */
const NOT_FOUND_KINDS: ReadonlySet<AppError['kind']> = new Set([
  'forbidden',
  'unauthorized',
  'validation',
]);

function failOrNotFound(error: AppError): never {
  if (NOT_FOUND_KINDS.has(error.kind)) {
    notFound();
  }
  escalate(error);
}

/**
 * The full administration page: calendar, services, resources and
 * locations. A person without `booking.read` gets "not found", the same
 * answer as for a website that does not exist; anything unexpected reaches
 * the route's error boundary.
 */
export async function BookingAdministration({
  websiteId,
  employees,
  locale,
}: BookingAdministrationProps) {
  const access = await bookingAdminQueries.getBookingAccess.execute();
  if (access.isErr()) {
    failOrNotFound(access.error);
  }
  // An employee has no part in the configuration: they get their own calendar and nothing else.
  if (access.value.isOwnOnly) {
    return <EmployeeBookings websiteId={websiteId} locale={locale} />;
  }

  const setup = await bookingAdminQueries.getBookingSetup.execute(websiteId);
  if (setup.isErr()) {
    failOrNotFound(setup.error);
  }

  return (
    <I18nProvider locale={locale} namespaces={['booking']}>
      <BookingAdmin
        websiteId={websiteId}
        setup={toBookingSetupDto(setup.value)}
        canConfigure={access.value.canConfigure}
        canManage={access.value.canManage}
        employees={employees.map(toEmployeeOptionDto)}
      />
    </I18nProvider>
  );
}
