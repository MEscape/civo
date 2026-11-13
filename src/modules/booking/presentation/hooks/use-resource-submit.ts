import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { applyActionError } from '@lib/actions';
import type { SerializedActionError } from '@lib/result';
import { deepEqual } from '@lib/utils';

import { BOOKING_ERROR_CODES as ERRORS } from '../../application/contracts/booking-constraints';
import { createBookableResourceAction } from '../actions/create-bookable-resource-action';
import { previewResourceChangeAction } from '../actions/preview-resource-change-action';
import { updateBookableResourceAction } from '../actions/update-bookable-resource-action';
import { toResourceInput } from '../forms/resource-form-values';
import { resourceListNavigation } from '../forms/resource-list-navigation';
import { bookingRoutes } from '../routes';

import type { ResourceDto, ResourceImpactDto } from '../dto/resource-dto';
import type { ResourceFormValues } from '../schemas/resource-schema';
import type { UseFormSetError } from 'react-hook-form';

/** A change that waits for the manager to have seen which bookings it reaches. */
export interface PendingResourceImpact {
  readonly values: ResourceFormValues;
  readonly data: ResourceImpactDto;
}

export interface ResourceSubmitOptions {
  readonly websiteId: string;
  readonly locationId: string;
  /** The resource being changed, or `null` while creating one. */
  readonly resource: ResourceDto | null;
  /** What the form started from: less time or fewer places is a difference from it. */
  readonly initial: ResourceFormValues;
  readonly setError: UseFormSetError<ResourceFormValues>;
  /** Called with the field paths a refused save named. */
  readonly onFieldErrors: (paths: Iterable<string>) => void;
  readonly listOrigin?: string | undefined;
}

/** Whether a change can take something away from existing bookings, so they have to be looked at first. */
function canAffectBookings(values: ResourceFormValues, initial: ResourceFormValues): boolean {
  return (
    values.capacity < initial.capacity ||
    values.followsLocation !== initial.followsLocation ||
    !deepEqual(values.openingHours, initial.openingHours)
  );
}

/**
 * Saving a resource. A new one is created. A change names the version it was made from; one that
 * gives the resource less time or fewer places first asks which existing bookings it would leave
 * without it, and is saved only after the manager has seen them. Success is shown only after the
 * server confirmed it, by arriving at the saved resource; a refusal is put on its field, shown as
 * the form's message, or (when somebody else saved first) as a notice that keeps the input.
 */
export function useResourceSubmit({
  websiteId,
  locationId,
  resource,
  initial,
  setError,
  onFieldErrors,
  listOrigin,
}: ResourceSubmitOptions) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formCode, setFormCode] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [impact, setImpact] = useState<PendingResourceImpact | null>(null);

  function failedWith(error: SerializedActionError) {
    if (error.code === ERRORS.resourceStale) {
      setIsStale(true);
      return;
    }
    setFormCode(applyActionError(error, setError));
    onFieldErrors(Object.keys(error.fieldErrors ?? {}));
  }

  function save(values: ResourceFormValues, acknowledgeImpact: boolean) {
    startTransition(async () => {
      const result =
        resource === null
          ? await createBookableResourceAction({ ...values, websiteId, locationId })
          : await updateBookableResourceAction({
              ...toResourceInput(values),
              websiteId,
              resourceId: resource.id,
              expectedVersion: resource.version,
              acknowledgeImpact,
            });
      setImpact(null);
      if (result.ok) {
        router.push(
          resourceListNavigation.withOrigin(
            `${bookingRoutes.resource(websiteId, locationId, result.data.id)}?saved=1`,
            listOrigin,
          ),
        );
        return;
      }
      failedWith(result.error);
    });
  }

  function submit(values: ResourceFormValues) {
    setFormCode(null);
    setIsStale(false);
    if (resource === null || !canAffectBookings(values, initial)) {
      save(values, false);
      return;
    }
    startTransition(async () => {
      const preview = await previewResourceChangeAction({
        websiteId,
        resourceId: resource.id,
        resource: toResourceInput(values),
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
