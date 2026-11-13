'use client';

import { WizardProgressBar } from '@components/shared/wizard';
import { Alert, AlertDescription } from '@components/ui/alert';
import { Button } from '@components/ui/button';

import { useStepFocus } from '@hooks/use-step-focus';

import { useTranslations } from '@i18n/client';

import { useBookingJourney } from '../../hooks/use-booking-journey';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

import { JourneyChoices } from './journey-choices';
import { JourneyStepView } from './journey-step-view.client';

import type { JourneyInput } from '../../hooks/use-booking-journey';

const NOTICE_KEYS = {
  'slot-taken': 'public.notice.slotTaken',
  'hold-expired': 'public.notice.holdExpired',
} as const;

/** The review and the confirmation show the whole booking already. */
const SUMMARIZED_STEPS: ReadonlySet<string> = new Set(['review', 'done']);

/**
 * Booking an appointment, step by step: where the visitor stands, the question of the step (focus
 * moves to it when the step changes), what went wrong in words, and the way back.
 *
 * The progress is one line and a bar, not a row of numbered steps: the journey sits in a
 * reading-width column, where up to seven labelled steps would not fit.
 */
export function BookingJourney(input: JourneyInput) {
  const t = useTranslations('booking');
  const journey = useBookingJourney(input);
  const { state, steps, errorCode } = journey;
  const { headingId, headingRef } = useStepFocus(state.step);

  return (
    <section aria-labelledby={headingId} className="space-y-6">
      <WizardProgressBar
        steps={steps.map((step) => ({ key: step, label: t(`public.steps.${step}`) }))}
        currentKey={state.step}
      />
      <h3 id={headingId} ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-copy">
        {t(`public.headings.${state.step}`)}
      </h3>
      {!SUMMARIZED_STEPS.has(state.step) && (
        <JourneyChoices service={journey.service} location={journey.location} />
      )}
      {state.notice !== null && (
        <Alert variant="warning" role="alert">
          <AlertDescription>{t(NOTICE_KEYS[state.notice])}</AlertDescription>
        </Alert>
      )}
      {errorCode !== null && (
        <Alert variant="danger" role="alert">
          <AlertDescription>{t(messageKeyForCode(errorCode), MESSAGE_PARAMS)}</AlertDescription>
        </Alert>
      )}
      <JourneyStepView catalog={input.catalog} journey={journey} />
      {state.step !== 'done' && steps.indexOf(state.step) > 0 && (
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          aria-disabled={journey.isPending ? true : undefined}
          onClick={() => {
            if (!journey.isPending) {
              journey.back();
            }
          }}
        >
          {t('public.back')}
        </Button>
      )}
    </section>
  );
}
