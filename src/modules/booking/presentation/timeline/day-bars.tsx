import { formatTimeOfDay } from '../../application/contracts/booking-constraints';

import { PERCENT } from './spans';

import type { Span } from './spans';

export interface DayBarsProps {
  readonly spans: readonly Span[];
  /** The hours the lane draws; the same for the lanes that are compared. */
  readonly window: Span;
  /** Names the lane for assistive technology, including what it shows when it is empty. */
  readonly label: string;
}

function percentOf(minute: number, window: Span): number {
  return ((minute - window.start) / (window.end - window.start)) * PERCENT;
}

/** A day's open stretches as bars, to look at and not to change: the picture an exception's preview is made of. */
export function DayBars({ spans, window, label }: DayBarsProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className="relative h-6 w-full overflow-hidden rounded-token-sm border border-border bg-canvas"
    >
      {spans.map((span) => (
        <span
          key={`${span.start}-${span.end}`}
          title={`${formatTimeOfDay(span.start)}–${formatTimeOfDay(span.end)}`}
          className="absolute inset-y-0.5 rounded-token-sm bg-primary"
          style={{
            left: `${percentOf(span.start, window)}%`,
            width: `${percentOf(span.end, window) - percentOf(span.start, window)}%`,
          }}
        />
      ))}
    </div>
  );
}
