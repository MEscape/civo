import { notFound } from 'next/navigation';

import { I18nProvider } from '@components/providers/i18n-provider';

import type { Locale } from '@i18n';

import type { AppError } from '@lib/errors';
import { escalate } from '@lib/errors/escalate';

import { bookingAdminQueries } from '../../composition';
import { toBookingSetupDto } from '../dto/setup-dto';

import { BookingAdmin } from './admin/booking-admin.client';

export interface BookingAdministrationProps {
  readonly websiteId: string;
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
export async function BookingAdministration({ websiteId, locale }: BookingAdministrationProps) {
  const [setup, access] = await Promise.all([
    bookingAdminQueries.getBookingSetup.execute(websiteId),
    bookingAdminQueries.getBookingAccess.execute(),
  ]);

  if (setup.isErr()) {
    failOrNotFound(setup.error);
  }
  if (access.isErr()) {
    failOrNotFound(access.error);
  }

  return (
    <I18nProvider locale={locale} namespaces={['booking']}>
      <BookingAdmin
        websiteId={websiteId}
        setup={toBookingSetupDto(setup.value)}
        canConfigure={access.value.canConfigure}
        canManage={access.value.canManage}
        scope="full"
      />
    </I18nProvider>
  );
}
