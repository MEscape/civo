'use client';

import { useEffect, useRef, useState } from 'react';

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

export interface BookingFlowProps {
  readonly websiteId: string;
  readonly catalog: PublicCatalogDto;
  /** A service the editor pinned the component to; the visitor then skips the service step. */
  readonly fixedServiceId: string | null;
  readonly heading: string;
  /** The editor canvas: everything shows, nothing is reserved or booked. */
  readonly readOnly: boolean;
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
}: BookingFlowProps) {
  const t = useTranslations('booking');
  const flow = useBookingFlow({ websiteId, catalog, fixedServiceId, readOnly });
  const [view, setView] = useState<'book' | 'manage'>('book');
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
