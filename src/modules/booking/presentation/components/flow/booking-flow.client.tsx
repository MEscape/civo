'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from 'react';

import { Alert, AlertDescription } from '@components/ui/alert';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { BOOKING_ERROR_CODES } from '../../../application/contracts/booking-constraints';
import { confirmBookingAction } from '../../actions/confirm-booking-action';
import { releaseHoldAction } from '../../actions/release-hold-action';
import { ErrorNotice } from '../shared/error-notice';

import { ConfirmationPanel } from './confirmation-panel';
import { DetailsStep } from './details-step';
import { collectDetails } from './details-validation';
import { findService, flowReducer, initialState, stepsFor } from './flow-state';
import { HoldTimer } from './hold-timer.client';
import { LocationStep } from './location-step';
import { ManageBooking } from './manage-booking.client';
import { ParticipantsStep } from './participants-step';
import { ReviewStep } from './review-step';
import { ServiceStep } from './service-step';
import { StepProgress } from './step-progress';
import { TimeStep } from './time-step.client';

import type { FlowConfig, FlowStep } from './flow-state';
import type { PublicCatalogDto } from '../../dto/catalog-dto';

export interface BookingFlowProps {
  readonly websiteId: string;
  readonly catalog: PublicCatalogDto;
  /** A service the editor pinned the component to; the visitor then skips the service step. */
  readonly fixedServiceId: string | null;
  readonly heading: string;
  /** The editor canvas: everything shows, nothing is reserved or booked. */
  readonly readOnly: boolean;
}

/** Codes after which the details cannot be saved and the visitor must pick a time again. */
const LOST_HOLD_CODES: ReadonlySet<string> = new Set([
  BOOKING_ERROR_CODES.bookingExpired,
  BOOKING_ERROR_CODES.bookingConflict,
  BOOKING_ERROR_CODES.bookingNotFound,
]);

/**
 * The public booking flow. The state machine (`flow-state.ts`) is pure; this
 * component wires it to the server actions: it reserves the time when the
 * visitor moves from the time to the details, releases it when they go back,
 * and commits it on confirm. All rules are enforced again on the server, so
 * nothing the browser does can book a time that is not free.
 */
export function BookingFlow({
  websiteId,
  catalog,
  fixedServiceId,
  heading,
  readOnly,
}: BookingFlowProps) {
  const t = useTranslations('booking');
  const config: FlowConfig = useMemo(
    () => ({ services: catalog.services, fixedServiceId }),
    [catalog.services, fixedServiceId],
  );
  const [state, dispatch] = useReducer(
    (current: ReturnType<typeof initialState>, action: Parameters<typeof flowReducer>[2]) =>
      flowReducer(config, current, action),
    config,
    initialState,
  );
  const [view, setView] = useState<'book' | 'manage'>('book');
  const [notice, setNotice] = useState<'hold-expired' | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Readonly<Record<string, string>>>({});
  const [isPending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef<FlowStep>(state.step);

  const service = findService(config, state.serviceId);
  const location =
    service?.locations.find((candidate) => candidate.id === state.locationId) ?? null;
  const steps = stepsFor(config, service);
  const holdId = state.hold?.holdId ?? null;

  // Move focus to the step heading when the step changes, never on first render.
  useEffect(() => {
    if (previousStep.current !== state.step) {
      previousStep.current = state.step;
      headingRef.current?.focus();
    }
  }, [state.step]);

  const expireHold = useCallback(() => {
    setNotice('hold-expired');
    dispatch({ type: 'hold-lost' });
  }, []);

  /** Gives the reservation back. Fire and forget: it would lapse on its own within minutes anyway. */
  function release() {
    if (holdId !== null && !readOnly) {
      void releaseHoldAction({ websiteId, holdId });
    }
    dispatch({ type: 'clear-hold' });
  }

  function confirm() {
    if (state.hold === null || service === null) {
      return;
    }
    const hold = state.hold;
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
        setServerErrors(
          Object.fromEntries(
            Object.entries(fields).map(([field, codes]) => [field, codes[0] ?? '']),
          ),
        );
        dispatch({ type: 'go-to', step: 'details' });
        return;
      }
      if (LOST_HOLD_CODES.has(result.error.code)) {
        setNotice(null);
        dispatch({ type: 'hold-lost' });
      }
      setErrorCode(result.error.code);
    });
  }

  if (view === 'manage') {
    const email = state.values['email'] ?? '';
    return (
      <FlowFrame heading={heading} headingRef={headingRef} title={t('manage.title')}>
        <ManageBooking
          websiteId={websiteId}
          services={catalog.services}
          initial={state.booking === null ? null : { booking: state.booking, email }}
          readOnly={readOnly}
          onBack={() => {
            setView('book');
          }}
        />
      </FlowFrame>
    );
  }

  return (
    <FlowFrame
      heading={heading}
      headingRef={headingRef}
      title={t(`steps.${state.step}`)}
      progress={<StepProgress steps={steps} current={state.step} />}
      footer={
        state.step === 'done' ? null : (
          <Button
            type="button"
            variant="link"
            onClick={() => {
              setView('manage');
            }}
          >
            {t('manage.link')}
          </Button>
        )
      }
    >
      {readOnly && (
        <Alert variant="info" className="mb-4">
          <AlertDescription>{t('preview.notice')}</AlertDescription>
        </Alert>
      )}

      {notice === 'hold-expired' && state.step === 'time' && (
        <Alert variant="warning" className="mb-4">
          <AlertDescription>{t('hold.expired')}</AlertDescription>
        </Alert>
      )}

      {errorCode !== null && (
        <div className="mb-4">
          <ErrorNotice code={errorCode} focus />
        </div>
      )}

      {state.hold !== null && (state.step === 'details' || state.step === 'review') && (
        <div className="mb-4">
          <HoldTimer expiresAt={state.hold.expiresAt} onExpired={expireHold} />
        </div>
      )}

      {state.step === 'service' && (
        <ServiceStep
          services={catalog.services}
          onSelect={(serviceId) => {
            dispatch({ type: 'select-service', serviceId });
          }}
        />
      )}

      {state.step === 'location' && service !== null && (
        <LocationStep
          locations={service.locations}
          selectedId={state.locationId}
          onSelect={(locationId) => {
            dispatch({ type: 'select-location', locationId });
          }}
        />
      )}

      {state.step === 'participants' && service !== null && (
        <ParticipantsStep
          initial={state.participants}
          max={service.maxParticipantsPerBooking}
          onSubmit={(participants) => {
            dispatch({ type: 'set-participants', participants });
            dispatch({ type: 'go-to', step: 'time' });
          }}
        />
      )}

      {state.step === 'time' && service !== null && state.locationId !== null && (
        <TimeStep
          websiteId={websiteId}
          service={service}
          locationId={state.locationId}
          participants={state.participants}
          slot={state.slot}
          timeZone={state.timeZone}
          readOnly={readOnly}
          onChoose={(slot, timeZone) => {
            setErrorCode(null);
            dispatch({ type: 'choose-slot', slot, timeZone });
          }}
          onTaken={() => {
            dispatch({ type: 'hold-lost' });
          }}
          onHeld={(hold) => {
            setNotice(null);
            setErrorCode(null);
            dispatch({ type: 'hold-acquired', hold });
          }}
        />
      )}

      {state.step === 'details' && service !== null && state.hold !== null && (
        <DetailsStep
          service={service}
          values={state.values}
          serverErrors={serverErrors}
          onChange={(field, value) => {
            setServerErrors({});
            dispatch({ type: 'set-value', field, value });
          }}
          onBack={() => {
            release();
            dispatch({ type: 'go-to', step: 'time' });
          }}
          onSubmit={() => {
            setServerErrors({});
            dispatch({ type: 'go-to', step: 'review' });
          }}
        />
      )}

      {state.step === 'review' && service !== null && state.hold !== null && (
        <ReviewStep
          service={service}
          hold={state.hold}
          values={state.values}
          locationAddress={location?.address ?? null}
          isPending={isPending}
          readOnly={readOnly}
          onBack={() => {
            dispatch({ type: 'go-to', step: 'details' });
          }}
          onConfirm={confirm}
        />
      )}

      {state.step === 'done' && state.booking !== null && (
        <ConfirmationPanel
          booking={state.booking}
          showParticipants={(service?.maxParticipantsPerBooking ?? 1) > 1}
          onManage={() => {
            setView('manage');
          }}
          onBookAnother={() => {
            dispatch({ type: 'restart' });
          }}
        />
      )}

      {state.step !== 'service' &&
        state.step !== 'done' &&
        state.step !== 'details' &&
        state.step !== 'review' &&
        stepsFor(config, service)[0] !== state.step && (
          <div className="mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const index = steps.indexOf(state.step);
                const previous = steps[index - 1];
                if (previous !== undefined) {
                  dispatch({ type: 'go-to', step: previous });
                }
              }}
            >
              {t('actions.back')}
            </Button>
          </div>
        )}
    </FlowFrame>
  );
}

interface FlowFrameProps {
  readonly heading: string;
  readonly title: string;
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>;
  readonly progress?: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly children: React.ReactNode;
}

function FlowFrame({ heading, title, headingRef, progress, footer, children }: FlowFrameProps) {
  return (
    <section
      aria-label={heading}
      className="rounded-token border border-border bg-surface p-4 shadow-sm sm:p-6"
    >
      <div className="space-y-4">
        {progress}
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-xl font-semibold text-copy outline-none"
        >
          {title}
        </h3>
      </div>
      <div className="mt-4">{children}</div>
      {footer !== null && footer !== undefined && (
        <div className="mt-6 border-t border-border pt-3">{footer}</div>
      )}
    </section>
  );
}
