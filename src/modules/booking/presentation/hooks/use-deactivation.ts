import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import {
  BOOKING_ERROR_CODES as ERRORS,
  SERVICE_RESOLUTIONS,
} from '../../application/contracts/booking-constraints';
import { deactivateServiceAction } from '../actions/deactivate-service-action';
import { previewServiceDeactivationAction } from '../actions/preview-service-deactivation-action';
import { reactivateServiceAction } from '../actions/reactivate-service-action';

import type {
  DeactivationMode,
  DeactivationScope,
  ServiceResolution,
} from '../../application/contracts/booking-constraints';
import type { DeactivationImpactDto, ServiceDto } from '../dto/service-dto';

/** Where the manager is in closing a service. */
export type DeactivationStage = 'closed' | 'choose' | 'review';

export interface DeactivationOptions {
  readonly service: ServiceDto;
  readonly locationId: string;
}

/**
 * Closing a service and opening it again. The manager first chooses how: only stop new bookings (the
 * existing ones stay valid) or review them; for a service that other locations have on, also whether
 * this location alone or every location. A review asks the server which bookings the closing
 * reaches, then each gets a decision (leave it or cancel it) before anything is changed. Nothing is
 * cancelled that was not chosen; the result is shown only after the server confirms it, by arriving
 * at the service again; a version somebody else moved on shows as a refusal and changes nothing.
 */
export function useDeactivation({ service, locationId }: DeactivationOptions) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [stage, setStage] = useState<DeactivationStage>('closed');
  const [mode, setMode] = useState<DeactivationMode>('block-new');
  const [scope, setScope] = useState<DeactivationScope>('location');
  const [impact, setImpact] = useState<DeactivationImpactDto | null>(null);
  const [decisions, setDecisions] = useState<Readonly<Record<string, ServiceResolution>>>({});
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const base = {
    websiteId: service.websiteId,
    serviceId: service.id,
    locationId,
    expectedVersion: service.version,
    expectedSettingVersion: service.settingVersion,
  };

  function fail(code: string) {
    setErrorCode(code);
    // A stale version cannot be saved on: the page must be read again.
    if (code === ERRORS.serviceStale) {
      setStage('closed');
      router.refresh();
    }
  }

  function close(resolutions: ReadonlyArray<{ bookingId: string; kind: string }>) {
    startTransition(async () => {
      const result = await deactivateServiceAction({ ...base, scope, mode, resolutions });
      if (result.ok) {
        setStage('closed');
        router.refresh();
        return;
      }
      fail(result.error.code);
    });
  }

  return {
    stage,
    mode,
    scope,
    impact,
    decisions,
    errorCode,
    isPending,
    open: () => {
      setErrorCode(null);
      setMode('block-new');
      setScope('location');
      setStage('choose');
    },
    cancel: () => {
      setStage('closed');
      setImpact(null);
      setDecisions({});
    },
    chooseMode: setMode,
    chooseScope: setScope,
    choose: (bookingId: string, kind: string) => {
      const resolution = SERVICE_RESOLUTIONS.find((candidate) => candidate === kind);
      if (resolution !== undefined) {
        setDecisions((current) => ({ ...current, [bookingId]: resolution }));
      }
    },
    /** "Block new bookings" closes at once; "review" first reads what the closing reaches. */
    proceed: () => {
      setErrorCode(null);
      if (mode === 'block-new') {
        close([]);
        return;
      }
      startTransition(async () => {
        const preview = await previewServiceDeactivationAction({
          websiteId: service.websiteId,
          serviceId: service.id,
          locationId,
          scope,
        });
        if (!preview.ok) {
          fail(preview.error.code);
          return;
        }
        setImpact(preview.data);
        setDecisions({});
        setStage('review');
      });
    },
    confirmReview: () => {
      close(Object.entries(decisions).map(([bookingId, kind]) => ({ bookingId, kind })));
    },
    reactivate: (reopening: DeactivationScope) => {
      setErrorCode(null);
      startTransition(async () => {
        const result = await reactivateServiceAction({ ...base, scope: reopening });
        if (result.ok) {
          router.refresh();
          return;
        }
        fail(result.error.code);
      });
    },
  };
}
