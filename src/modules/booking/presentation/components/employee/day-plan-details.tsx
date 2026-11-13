import { HandBackButton } from './hand-back-button.client';
import { OutcomeButtons } from './outcome-buttons.client';

import type { DayPlanItemDto } from '../../dto/employee-dto';
import type { BookingTranslator } from '../../translation/translator';

export interface DayPlanDetailsProps {
  readonly t: BookingTranslator;
  readonly item: DayPlanItemDto;
  readonly name: string;
  /** The employee takes bookings: giving one back is theirs to offer. */
  readonly mayHandBack: boolean;
}

/**
 * What a row of the day opens to: the notes for the appointment and what to check, and what the
 * employee can do with it: record that it took place or that nobody came once it began, or give it
 * back where the service lets them.
 */
export function DayPlanDetails({ t, item, name, mayHandBack }: DayPlanDetailsProps) {
  const canGiveBack = mayHandBack && item.mayHandBack;
  return (
    <div className="space-y-3 border-t border-border bg-canvas p-4 text-sm">
      <p className="text-copy-muted">{item.instructions ?? t('employee.plan.noInstructions')}</p>
      {item.requiredDocuments.length > 0 && (
        <ul className="list-disc ps-5 text-copy">
          {item.requiredDocuments.map((document) => (
            <li key={document}>{document}</li>
          ))}
        </ul>
      )}
      {(canGiveBack || item.mayRecordOutcome) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-t border-border pt-3">
          {item.mayRecordOutcome ? (
            <OutcomeButtons bookingId={item.booking.id} name={name} />
          ) : (
            <span />
          )}
          {canGiveBack && <HandBackButton bookingId={item.booking.id} name={name} />}
        </div>
      )}
    </div>
  );
}
