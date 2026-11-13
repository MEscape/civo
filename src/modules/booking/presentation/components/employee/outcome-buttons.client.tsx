'use client';

import { Check, Close } from '@components/icons/icons';
import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useRecordOutcome } from '../../hooks/use-record-outcome';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

export interface OutcomeButtonsProps {
  readonly bookingId: string;
  /** The service, so each button names the booking it is about. */
  readonly name: string;
}

/**
 * What the employee records once an appointment has begun: that it took place, or that nobody came.
 * Moving and cancelling stay with the managers, so the employee never changes what the citizen was promised.
 */
export function OutcomeButtons({ bookingId, name }: OutcomeButtonsProps) {
  const t = useTranslations('booking');
  const outcome = useRecordOutcome(bookingId);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={outcome.isPending}
          aria-label={t('employee.outcome.completeNamed', { name })}
          onClick={() => {
            outcome.record('completed');
          }}
        >
          <Check aria-hidden="true" />
          {t('employee.outcome.complete')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={outcome.isPending}
          aria-label={t('employee.outcome.noShowNamed', { name })}
          onClick={() => {
            outcome.record('no_show');
          }}
        >
          <Close aria-hidden="true" />
          {t('employee.outcome.noShow')}
        </Button>
      </div>
      {outcome.errorCode !== null && (
        <FieldMessage
          id={`outcome-error-${bookingId}`}
          message={t(messageKeyForCode(outcome.errorCode), MESSAGE_PARAMS)}
        />
      )}
    </div>
  );
}
