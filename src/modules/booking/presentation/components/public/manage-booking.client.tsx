'use client';

import { useState } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { dayOf } from '../../forms/month-calendar';

import { LookupForm } from './lookup-form.client';
import { OwnBooking } from './own-booking.client';

import type { BookingCatalogDto } from '../../dto/catalog-dto';
import type { FoundBooking } from '../../hooks/use-booking-lookup';

export interface ManageBookingProps {
  readonly websiteId: string;
  readonly catalog: BookingCatalogDto;
  /** The reference of the link the visitor came by (`?manage=`): they only add their address. */
  readonly initialReference: string | undefined;
}

/** Used when the booking's service is no longer offered online: the server still bounds the real horizon. */
const FALLBACK_HORIZON_DAYS = 365;

/** "My booking": look it up by its number and address, then see, move or cancel it. */
export function ManageBooking({ websiteId, catalog, initialReference }: ManageBookingProps) {
  const t = useTranslations('booking');
  const [lookup, setLookup] = useState<{
    readonly found: FoundBooking | null;
    readonly shouldFocusReference: boolean;
  }>({ found: null, shouldFocusReference: false });

  if (lookup.found === null) {
    return (
      <LookupForm
        websiteId={websiteId}
        initialReference={initialReference}
        shouldFocusReference={lookup.shouldFocusReference}
        onFound={(found) => {
          setLookup({ found, shouldFocusReference: false });
        }}
      />
    );
  }
  const { booking } = lookup.found;
  const location = catalog.locations.find((candidate) => candidate.id === booking.locationId);
  const service = catalog.services.find((candidate) => candidate.id === booking.serviceId);
  return (
    <div className="space-y-6">
      <OwnBooking
        key={booking.reference}
        websiteId={websiteId}
        found={lookup.found}
        today={location?.today ?? dayOf(booking.start)}
        horizonDays={service?.horizonDays ?? FALLBACK_HORIZON_DAYS}
      />
      <Button
        type="button"
        variant="link"
        className="min-h-11"
        onClick={() => {
          setLookup({ found: null, shouldFocusReference: true });
        }}
      >
        {t('public.manage.other')}
      </Button>
    </div>
  );
}
