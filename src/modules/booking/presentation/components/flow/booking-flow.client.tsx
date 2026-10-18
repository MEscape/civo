'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useBookingFlow } from '../../hooks/use-booking-flow';

import { FlowFrame } from './flow-frame';
import { FlowNotices } from './flow-notices';
import { FlowStepView } from './flow-step-view';
import { ManageBooking } from './manage-booking.client';
import { StepProgress } from './step-progress';

import type { PublicCatalogDto } from '../../dto/catalog-dto';
import type { FlowStep } from '../../flow/flow-state';

/** The address parameter that opens "my booking"; the e-mail links carry it. */
const MANAGE_PARAM = 'manage';
const MAX_LINKED_REFERENCE = 32;

const noSubscription = () => () => undefined;

/**
 * The reference of the link in the confirmation e-mail (`?manage=`), read from
 * the address in the browser; `undefined` on the server and for a page without
 * one. Nothing is read in the editor, where nothing may be looked up.
 */
function useLinkedReference(readOnly: boolean): string | undefined {
  return useSyncExternalStore(
    noSubscription,
    () => {
      const reference = new URLSearchParams(window.location.search).get(MANAGE_PARAM)?.trim();
      const isUsable =
        !readOnly &&
        reference !== undefined &&
        reference !== '' &&
        reference.length <= MAX_LINKED_REFERENCE;
      return isUsable ? reference : undefined;
    },
    () => undefined,
  );
}

export interface BookingFlowProps {
  readonly websiteId: string;
  readonly catalog: PublicCatalogDto;
  /** A service the editor pinned the component to; the visitor then skips the service step. */
  readonly fixedServiceId: string | null;
  readonly heading: string;
  /** The editor canvas: everything shows, nothing is reserved or booked. */
  readonly readOnly: boolean;
  /** The catalog is placeholder content for the editor: its times are invented in the browser. */
  readonly isSample?: boolean;
}

/**
 * The public booking flow: the steps of a booking, or "my booking" to look
 * one up. The state machine (`flow-state.ts`) is pure and `useBookingFlow`
 * wires it to the server actions; this component is the frame around them.
 */
export function BookingFlow({
  websiteId,
  catalog,
  fixedServiceId,
  heading,
  readOnly,
  isSample = false,
}: BookingFlowProps) {
  const t = useTranslations('booking');
  const flow = useBookingFlow({ websiteId, catalog, fixedServiceId, readOnly });
  // `null` follows the link of the confirmation e-mail, if there is one; a choice of the visitor replaces it.
  const [chosenView, setView] = useState<'book' | 'manage' | null>(null);
  const linkedReference = useLinkedReference(readOnly);
  const view = chosenView ?? (linkedReference === undefined ? 'book' : 'manage');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef<FlowStep>(flow.state.step);
  const { state } = flow;

  // Move focus to the step heading when the step changes, never on first render.
  useEffect(() => {
    if (previousStep.current !== state.step) {
      previousStep.current = state.step;
      headingRef.current?.focus();
    }
  }, [state.step]);

  // Arriving from the e-mail, the booking is brought into view and its heading takes focus, wherever on the page it sits.
  useEffect(() => {
    if (linkedReference !== undefined) {
      headingRef.current?.scrollIntoView({ block: 'center' });
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [linkedReference]);

  if (view === 'manage') {
    return (
      <FlowFrame heading={heading} headingRef={headingRef} title={t('manage.title')}>
        <ManageBooking
          websiteId={websiteId}
          services={catalog.services}
          initial={
            state.booking === null
              ? null
              : { booking: state.booking, email: state.values['email'] ?? '' }
          }
          initialReference={linkedReference}
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
      progress={<StepProgress steps={flow.steps} current={state.step} />}
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
      <FlowNotices
        step={state.step}
        readOnly={readOnly}
        isHoldExpired={flow.isHoldExpired}
        errorCode={flow.errorCode}
        holdExpiresAt={state.hold?.expiresAt ?? null}
        onHoldExpired={flow.expireHold}
      />

      <FlowStepView
        websiteId={websiteId}
        flow={flow}
        readOnly={readOnly}
        isSample={isSample}
        onManage={() => {
          setView('manage');
        }}
      />

      {flow.canGoBack && (
        <div className="mt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const previous = flow.steps[flow.steps.indexOf(state.step) - 1];
              if (previous !== undefined) {
                flow.dispatch({ type: 'go-to', step: previous });
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
