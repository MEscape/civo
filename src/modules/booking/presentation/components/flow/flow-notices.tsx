import { Alert, AlertDescription } from '@components/ui/alert';

import { useTranslations } from '@i18n/client';

import { ErrorNotice } from '../shared/error-notice';

import { HoldTimer } from './hold-timer.client';

import type { FlowStep } from '../../flow/flow-state';

/** The steps during which the visitor holds a reservation and a countdown is shown. */
const HOLD_STEPS: ReadonlySet<FlowStep> = new Set<FlowStep>(['details', 'review']);

export interface FlowNoticesProps {
  readonly step: FlowStep;
  readonly readOnly: boolean;
  readonly isHoldExpired: boolean;
  readonly errorCode: string | null;
  /** When the current reservation lapses; `null` while nothing is reserved. */
  readonly holdExpiresAt: string | null;
  readonly onHoldExpired: () => void;
}

/** What sits above the current step: the preview notice, a lapsed reservation, an error, the countdown. */
export function FlowNotices({
  step,
  readOnly,
  isHoldExpired,
  errorCode,
  holdExpiresAt,
  onHoldExpired,
}: FlowNoticesProps) {
  const t = useTranslations('booking');

  return (
    <>
      {readOnly && (
        <Alert variant="info" className="mb-4">
          <AlertDescription>{t('preview.notice')}</AlertDescription>
        </Alert>
      )}

      {isHoldExpired && step === 'time' && (
        <Alert variant="warning" className="mb-4">
          <AlertDescription>{t('hold.expired')}</AlertDescription>
        </Alert>
      )}

      {errorCode !== null && (
        <div className="mb-4">
          <ErrorNotice code={errorCode} focus />
        </div>
      )}

      {holdExpiresAt !== null && HOLD_STEPS.has(step) && (
        <div className="mb-4">
          <HoldTimer expiresAt={holdExpiresAt} onExpired={onHoldExpired} />
        </div>
      )}
    </>
  );
}
