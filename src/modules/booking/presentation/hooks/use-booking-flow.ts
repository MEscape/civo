import { useCallback, useMemo, useReducer, useState, useTransition } from 'react';
import type { Dispatch } from 'react';

import { BOOKING_ERROR_CODES } from '../../application/contracts/booking-constraints';
import { confirmBookingAction } from '../actions/confirm-booking-action';
import { releaseHoldAction } from '../actions/release-hold-action';
import { collectDetails } from '../flow/details-validation';
import { findService, flowReducer, initialState, stepsFor } from '../flow/flow-state';

import type { SlotDto } from '../dto/availability-dto';
import type { HoldDto } from '../dto/booking-dto';
import type { PublicCatalogDto, PublicServiceDto } from '../dto/catalog-dto';
import type { FlowAction, FlowConfig, FlowState, FlowStep } from '../flow/flow-state';

/** The steps with a back button; from the details on, going back would have to give up the reserved time. */
const BACK_STEPS: ReadonlySet<FlowStep> = new Set<FlowStep>(['location', 'participants', 'time']);

/** Codes after which the details cannot be saved and the visitor must pick a time again. */
const LOST_HOLD_CODES: ReadonlySet<string> = new Set([
  BOOKING_ERROR_CODES.bookingExpired,
  BOOKING_ERROR_CODES.bookingConflict,
  BOOKING_ERROR_CODES.bookingNotFound,
]);

export interface BookingFlowOptions {
  readonly websiteId: string;
  readonly catalog: PublicCatalogDto;
  readonly fixedServiceId: string | null;
  /** The editor canvas: nothing is reserved or booked. */
  readonly readOnly: boolean;
}

export interface BookingFlowController {
  readonly config: FlowConfig;
  readonly state: FlowState;
  readonly dispatch: Dispatch<FlowAction>;
  readonly service: PublicServiceDto | null;
  readonly locationAddress: string | null;
  readonly steps: readonly FlowStep[];
  readonly canGoBack: boolean;
  readonly isHoldExpired: boolean;
  readonly errorCode: string | null;
  readonly serverErrors: Readonly<Record<string, string>>;
  readonly isPending: boolean;
  readonly expireHold: () => void;
  readonly chooseSlot: (slot: SlotDto, timeZone: string) => void;
  readonly acquireHold: (hold: HoldDto) => void;
  readonly changeValue: (field: string, value: string) => void;
  readonly submitDetails: () => void;
  readonly backFromDetails: () => void;
  readonly confirm: () => void;
}

function firstCodes(
  fields: Readonly<Record<string, readonly string[]>>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(fields).map(([field, codes]) => [field, codes[0] ?? '']),
  );
}

/**
 * Wires the pure flow state machine to the server actions: reserves nothing
 * itself (the time step does), gives a reservation back when the visitor
 * goes back, and commits it on confirm. Every rule is enforced again on the
 * server, so nothing the browser does can book a time that is not free.
 */
export function useBookingFlow({
  websiteId,
  catalog,
  fixedServiceId,
  readOnly,
}: BookingFlowOptions): BookingFlowController {
  const config: FlowConfig = useMemo(
    () => ({ services: catalog.services, fixedServiceId }),
    [catalog.services, fixedServiceId],
  );
  const [state, dispatch] = useReducer(
    (current: FlowState, action: FlowAction) => flowReducer(config, current, action),
    config,
    initialState,
  );
  const [isHoldExpired, setIsHoldExpired] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Readonly<Record<string, string>>>({});
  const [isPending, startTransition] = useTransition();

  const service = findService(config, state.serviceId);
  const location = service?.locations.find((candidate) => candidate.id === state.locationId);
  const steps = stepsFor(config, service);

  const expireHold = useCallback(() => {
    setIsHoldExpired(true);
    dispatch({ type: 'hold-lost' });
  }, []);

  function confirm() {
    const { hold } = state;
    if (hold === null || service === null) {
      return;
    }
    setErrorCode(null);
    startTransition(async () => {
      const result = await confirmBookingAction({
        websiteId,
        holdId: hold.holdId,
        customer: collectDetails(service, state.values),
      });
      if (result.ok) {
        dispatch({ type: 'confirmed', booking: result.data });
        return;
      }
      const fields = result.error.fieldErrors;
      if (fields !== undefined && Object.keys(fields).length > 0) {
        setServerErrors(firstCodes(fields));
        dispatch({ type: 'go-to', step: 'details' });
        return;
      }
      if (LOST_HOLD_CODES.has(result.error.code)) {
        setIsHoldExpired(false);
        dispatch({ type: 'hold-lost' });
      }
      setErrorCode(result.error.code);
    });
  }

  return {
    config,
    state,
    dispatch,
    service,
    locationAddress: location?.address ?? null,
    steps,
    canGoBack: BACK_STEPS.has(state.step) && steps[0] !== state.step,
    isHoldExpired,
    errorCode,
    serverErrors,
    isPending,
    expireHold,
    chooseSlot: (slot, timeZone) => {
      setErrorCode(null);
      dispatch({ type: 'choose-slot', slot, timeZone });
    },
    acquireHold: (hold) => {
      setIsHoldExpired(false);
      setErrorCode(null);
      dispatch({ type: 'hold-acquired', hold });
    },
    changeValue: (field, value) => {
      setServerErrors({});
      dispatch({ type: 'set-value', field, value });
    },
    submitDetails: () => {
      setServerErrors({});
      dispatch({ type: 'go-to', step: 'review' });
    },
    // Gives the reservation back. Fire and forget: it would lapse on its own within minutes anyway.
    backFromDetails: () => {
      if (state.hold !== null && !readOnly) {
        void releaseHoldAction({ websiteId, holdId: state.hold.holdId });
      }
      dispatch({ type: 'clear-hold' });
      dispatch({ type: 'go-to', step: 'time' });
    },
    confirm,
  };
}
