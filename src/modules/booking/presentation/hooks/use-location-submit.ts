import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { applyActionError } from '@lib/actions';
import type { SerializedActionError } from '@lib/result';
import { deepEqual } from '@lib/utils';

import { BOOKING_ERROR_CODES as ERRORS } from '../../application/contracts/booking-constraints';
import { adoptServiceAction } from '../actions/adopt-service-action';
import { createBookingLocationAction } from '../actions/create-booking-location-action';
import { previewLocationChangeAction } from '../actions/preview-location-change-action';
import { updateBookingLocationAction } from '../actions/update-booking-location-action';
import { sectionsOfFailure } from '../forms/field-errors';
import { locationListNavigation } from '../forms/location-list-navigation';
import { NOT_TAKEN_OVER_PARAM } from '../forms/take-over-param';
import { bookingRoutes } from '../routes';

import type { Offer } from './use-location-offer';
import type { LocationDto, LocationImpactDto } from '../dto/location-dto';
import type { AdoptableServiceDto } from '../dto/service-dto';
import type { LocationFormValues } from '../schemas/location-schema';
import type { FieldPath, UseFormSetError } from 'react-hook-form';

/** A code the server answers for one field, so it is shown on that field and not as a form message. */
const CODE_FIELDS: Readonly<Record<string, FieldPath<LocationFormValues>>> = {
  [ERRORS.timeZoneLocked]: 'timeZone',
};

/** A change that waits for the manager to have seen which bookings it reaches. */
export interface PendingImpact {
  readonly values: LocationFormValues;
  readonly data: LocationImpactDto;
}

export interface LocationSubmitOptions {
  readonly websiteId: string;
  /** The location being changed, or `null` while creating one. */
  readonly location: LocationDto | null;
  /** What the form started from: a change of the hours is a difference from it. */
  readonly initial: LocationFormValues;
  readonly setError: UseFormSetError<LocationFormValues>;
  /** Called with the sections a refused save named fields in. */
  readonly onFieldErrors: (sections: ReadonlySet<string>) => void;
  readonly listOrigin?: string | undefined;
  /** A new location only: the services of other locations it takes over once it exists. */
  readonly offer?: { readonly choice: Offer; readonly services: readonly AdoptableServiceDto[] };
}

/**
 * Takes over the chosen services at the location just made, one after the other (the server applies
 * its rules to each). Returns how many were refused; the location itself stands either way.
 */
async function takeOver(
  websiteId: string,
  locationId: string,
  offer: NonNullable<LocationSubmitOptions['offer']>,
): Promise<number> {
  let refused = 0;
  for (const service of offer.services) {
    if (!offer.choice.isChosen(service.id) || service.source === null) {
      continue;
    }
    const result = await adoptServiceAction({
      websiteId,
      locationId,
      serviceId: service.id,
      sourceLocationId: service.source.id,
      mode: offer.choice.mode,
    });
    if (!result.ok) {
      refused += 1;
    }
  }
  return refused;
}

/**
 * Saving a location. A new one is created. A change names the version it was made from; one that
 * changes the hours first asks which existing bookings it would leave outside them, and is saved
 * only after the manager has seen them. Success is shown only after the server has confirmed it, by
 * arriving at the saved location; a refusal is put on its field, or shown as the form's message, or
 * (when somebody else saved first) as a stale notice that keeps the input on screen.
 */
export function useLocationSubmit({
  websiteId,
  location,
  initial,
  setError,
  onFieldErrors,
  listOrigin,
  offer,
}: LocationSubmitOptions) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formCode, setFormCode] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [impact, setImpact] = useState<PendingImpact | null>(null);

  function failedWith(error: SerializedActionError) {
    if (error.code === ERRORS.locationStale) {
      setIsStale(true);
      return;
    }
    setFormCode(applyActionError(error, setError, CODE_FIELDS));
    onFieldErrors(sectionsOfFailure(error));
  }

  function save(values: LocationFormValues, acknowledgeImpact: boolean) {
    startTransition(async () => {
      const result =
        location === null
          ? await createBookingLocationAction({ ...values, websiteId })
          : await updateBookingLocationAction({
              ...values,
              websiteId,
              locationId: location.id,
              expectedVersion: location.version,
              acknowledgeImpact,
            });
      setImpact(null);
      if (result.ok) {
        const refused =
          location === null && offer !== undefined
            ? await takeOver(websiteId, result.data.id, offer)
            : 0;
        const notTaken = refused === 0 ? '' : `&${NOT_TAKEN_OVER_PARAM}=${String(refused)}`;
        router.push(
          locationListNavigation.withOrigin(
            `${bookingRoutes.location(websiteId, result.data.id)}?saved=1${notTaken}`,
            listOrigin,
          ),
        );
        return;
      }
      failedWith(result.error);
    });
  }

  function submit(values: LocationFormValues) {
    setFormCode(null);
    setIsStale(false);
    if (location === null || deepEqual(values.openingHours, initial.openingHours)) {
      save(values, false);
      return;
    }
    startTransition(async () => {
      const preview = await previewLocationChangeAction({
        websiteId,
        locationId: location.id,
        location: values,
      });
      if (!preview.ok) {
        failedWith(preview.error);
        return;
      }
      if (preview.data.affected.length > 0 || preview.data.isTruncated) {
        setImpact({ values, data: preview.data });
        return;
      }
      save(values, false);
    });
  }

  return {
    isPending,
    formCode,
    isStale,
    impact,
    submit,
    confirmImpact: () => {
      if (impact !== null) {
        save(impact.values, true);
      }
    },
    dismissImpact: () => {
      setImpact(null);
    },
  };
}
