import { DEFAULT_HOURS_RANGE, widenRange } from '../../forms/week/range';
import { timeOf } from '../../forms/week/time';
import { HoursAxis } from '../shared/day-hours-bar';
import { OPEN_FILL } from '../shared/hours-swatch';

const PERCENT = 100;

export interface WindowBarProps {
  readonly startMinute: number;
  readonly endMinute: number;
}

/**
 * The part of the day the employee likes to work, drawn like a day of the opening hours: the same
 * axis, the same track and the same solid fill, read only. The fields beside it are what is edited.
 */
export function WindowBar({ startMinute, endMinute }: WindowBarProps) {
  const isValid =
    Number.isFinite(startMinute) && Number.isFinite(endMinute) && endMinute > startMinute;
  const range = isValid
    ? widenRange(DEFAULT_HOURS_RANGE, [
        { intervals: [{ start: timeOf(startMinute), end: timeOf(endMinute) }], breaks: [] },
      ])
    : DEFAULT_HOURS_RANGE;
  const span = range.to - range.from;

  return (
    <div className="space-y-1" dir="ltr" aria-hidden="true">
      <HoursAxis range={range} />
      <div className="relative h-8 rounded-token-sm bg-border/50">
        {isValid && (
          <span
            className={`absolute inset-y-1 rounded-token-sm ${OPEN_FILL}`}
            style={{
              left: `${((startMinute - range.from) / span) * PERCENT}%`,
              width: `${((endMinute - startMinute) / span) * PERCENT}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}
