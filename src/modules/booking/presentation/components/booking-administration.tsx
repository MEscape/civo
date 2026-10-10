import { notFound } from 'next/navigation';

import { I18nProvider } from '@components/providers/i18n-provider';

import { bookingAdminQueries } from '../../composition';
import { toBookingSetupDto } from '../dto/setup-dto';

import { BookingAdmin } from './admin/booking-admin.client';

export interface BookingAdministrationProps {
  readonly websiteId: string;
}

/**
 * The full administration page: calendar, services, resources and
 * locations. A person without `booking.read` gets "not found", the same
 * answer as for a website that does not exist; anything unexpected reaches
 * the route's error boundary.
 */
export async function BookingAdministration({ websiteId }: BookingAdministrationProps) {
  const [setup, access] = await Promise.all([
    bookingAdminQueries.getBookingSetup.execute(websiteId),
    bookingAdminQueries.getBookingAccess.execute(),
  ]);

  if (setup.isErr() || access.isErr()) {
    const error =
      (setup.isErr() ? setup.error : undefined) ?? (access.isErr() ? access.error : undefined);
    if (
      error?.kind === 'forbidden' ||
      error?.kind === 'unauthorized' ||
      error?.kind === 'validation'
    ) {
      notFound();
    }
    throw new Error(error?.code ?? 'booking.unexpected', { cause: error });
  }

  return (
    <I18nProvider namespaces={['booking']}>
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
