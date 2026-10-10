import { connection } from 'next/server';

import { I18nProvider } from '@components/providers/i18n-provider';

import { bookingAdminQueries, bookingPublicQueries } from '../../composition';
import { toPublicCatalogDto } from '../dto/catalog-dto';
import { toBookingSetupDto } from '../dto/setup-dto';

import { BookingAdmin } from './admin/booking-admin.client';
import { BookingState } from './booking-state';
import { BookingFlow } from './flow/booking-flow.client';

export interface BookingSectionProps {
  /** The website being rendered, derived by the server: never an editor-authored value. */
  readonly websiteId: string;
  /** `public`: visitors book; `admin`: staff see the operations calendar. */
  readonly mode: 'public' | 'admin';
  /** `draft` is the editor canvas: it shows everything and reserves nothing. */
  readonly renderMode: 'draft' | 'published';
  readonly heading: string;
  /** Pins the public flow to one service (an editor choice). */
  readonly serviceId?: string | undefined;
  /** Narrows the public flow to one category. */
  readonly category?: string | undefined;
}

/**
 * The server half of the booking component. It loads what the browser needs
 * as plain DTOs (the service catalog for visitors, the setup and the access
 * rights for staff) and hands them to the client screens. The browser never
 * receives an entity, a tenant or anything a visitor should not see.
 */
export async function BookingSection({
  websiteId,
  mode,
  renderMode,
  heading,
  serviceId,
  category,
}: BookingSectionProps) {
  // Availability and the catalog change by the minute: never part of a prerendered page.
  await connection();
  if (mode === 'admin') {
    return <StaffCalendar websiteId={websiteId} heading={heading} />;
  }

  const catalog = await bookingPublicQueries.getBookingCatalog.execute({
    websiteId,
    category,
    serviceIds: serviceId === undefined ? undefined : [serviceId],
  });

  if (catalog.isErr()) {
    return <BookingState kind="unavailable" heading={heading} />;
  }
  if (catalog.value.services.length === 0) {
    return (
      <BookingState kind={renderMode === 'draft' ? 'empty-draft' : 'empty'} heading={heading} />
    );
  }

  return (
    <I18nProvider namespaces={['booking']}>
      <BookingFlow
        websiteId={websiteId}
        catalog={toPublicCatalogDto(catalog.value)}
        fixedServiceId={serviceId ?? null}
        heading={heading}
        readOnly={renderMode === 'draft'}
      />
    </I18nProvider>
  );
}

async function StaffCalendar({
  websiteId,
  heading,
}: {
  readonly websiteId: string;
  readonly heading: string;
}) {
  const [setup, access] = await Promise.all([
    bookingAdminQueries.getBookingSetup.execute(websiteId),
    bookingAdminQueries.getBookingAccess.execute(),
  ]);

  if (setup.isErr() || access.isErr()) {
    const error =
      (setup.isErr() ? setup.error : undefined) ?? (access.isErr() ? access.error : undefined);
    const notAllowed = error?.kind === 'unauthorized' || error?.kind === 'forbidden';
    return <BookingState kind={notAllowed ? 'staff-only' : 'unavailable'} heading={heading} />;
  }

  return (
    <I18nProvider namespaces={['booking']}>
      <BookingAdmin
        websiteId={websiteId}
        setup={toBookingSetupDto(setup.value)}
        canConfigure={access.value.canConfigure}
        canManage={access.value.canManage}
        scope="calendar"
      />
    </I18nProvider>
  );
}
