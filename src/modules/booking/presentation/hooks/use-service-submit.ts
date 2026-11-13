import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { applyActionError } from '@lib/actions';
import type { SerializedActionError } from '@lib/result';

import { BOOKING_ERROR_CODES as ERRORS } from '../../application/contracts/booking-constraints';
import { createBookableServiceAction } from '../actions/create-bookable-service-action';
import { updateBookableServiceAction } from '../actions/update-bookable-service-action';
import { changedSharedFields } from '../forms/service-form-values';
import { serviceListNavigation } from '../forms/service-list-navigation';
import { partsOfPaths } from '../forms/service-steps';
import { bookingRoutes } from '../routes';

import type { ServiceDto } from '../dto/service-dto';
import type { SharedField } from '../forms/service-form-values';
import type { ServiceFormValues } from '../schemas/service-schema';
import type { UseFormSetError } from 'react-hook-form';

/** A change that waits for the manager to know it reaches other locations too. */
export interface PendingShared {
  readonly values: ServiceFormValues;
  readonly changed: readonly SharedField[];
}

export interface ServiceSubmitOptions {
  readonly websiteId: string;
  readonly locationId: string;
  /** The service being changed, or `null` while creating one. */
  readonly service: ServiceDto | null;
  /** What the form started from: a change to the shared definition is a difference from it. */
  readonly initial: ServiceFormValues;
  readonly setError: UseFormSetError<ServiceFormValues>;
  /** Called with the parts a refused save named fields in. */
  readonly onFieldErrors: (parts: ReadonlySet<string>) => void;
  readonly listOrigin?: string | undefined;
}

/**
 * Saving a service. A new one is created. A change names the versions it was made from; one that
 * changes what other locations share is first put to the manager, with how many places it reaches, and
 * saved only after they have said they know. Success is shown only after the server has confirmed it,
 * by arriving at the saved service; a refusal is put on its field, or shown as the form's message, or
 * (when somebody else saved first) as a stale notice that keeps the input on screen.
 */
export function useServiceSubmit({
  websiteId,
  locationId,
  service,
  initial,
  setError,
  onFieldErrors,
  listOrigin,
}: ServiceSubmitOptions) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formCode, setFormCode] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [pendingShared, setPendingShared] = useState<PendingShared | null>(null);

  function failedWith(error: SerializedActionError, values: ServiceFormValues) {
    if (error.code === ERRORS.serviceStale) {
      setIsStale(true);
      return;
    }
    if (error.code === ERRORS.serviceSharedUnacknowledged) {
      // The server knows what reaches other locations even when the form did not: put it to the manager.
      setPendingShared({ values, changed: changedSharedFields(initial, values) });
      return;
    }
    setFormCode(applyActionError(error, setError));
    onFieldErrors(partsOfPaths(Object.keys(error.fieldErrors ?? {})));
  }

  function save(values: ServiceFormValues, acknowledgeShared: boolean) {
    startTransition(async () => {
      const result =
        service === null
          ? await createBookableServiceAction({ ...values, websiteId, locationId })
          : await updateBookableServiceAction({
              ...values,
              websiteId,
              locationId,
              serviceId: service.id,
              expectedVersion: service.version,
              expectedSettingVersion: service.settingVersion,
              acknowledgeShared,
            });
      setPendingShared(null);
      if (result.ok) {
        router.push(
          serviceListNavigation.withOrigin(
            `${bookingRoutes.service(websiteId, locationId, result.data.id)}?saved=1`,
            listOrigin,
          ),
        );
        return;
      }
      failedWith(result.error, values);
    });
  }

  function submit(values: ServiceFormValues) {
    setFormCode(null);
    setIsStale(false);
    const changed = changedSharedFields(initial, values);
    if (service !== null && service.sharedWith.length > 0 && changed.length > 0) {
      setPendingShared({ values, changed });
      return;
    }
    save(values, false);
  }

  return {
    isPending,
    formCode,
    isStale,
    pendingShared,
    submit,
    confirmShared: () => {
      if (pendingShared !== null) {
        save(pendingShared.values, true);
      }
    },
    dismissShared: () => {
      setPendingShared(null);
    },
  };
}
