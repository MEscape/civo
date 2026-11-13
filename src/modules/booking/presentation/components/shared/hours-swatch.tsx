import { cn } from '@lib/utils';

import type { RangeKind } from '../../forms/week/change-range';

/** The break's pattern, on the bar and wherever the break is named: stripes on white, so it reads as a gap cut out of the open time. */
export const BREAK_HATCH =
  'border border-border bg-surface bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,var(--color-border)_4px,var(--color-border)_6px)]';

/** What the open time looks like on the bar. */
export const OPEN_FILL = 'bg-primary';

/**
 * The little sample of how a kind of range is drawn on the bar (solid for open time, stripes for a
 * break): beside a label it says which is which wherever the hours are written as fields. Decoration:
 * the word beside it carries the meaning.
 */
export function HoursSwatch({
  kind,
  className,
}: {
  readonly kind: RangeKind | 'closed';
  readonly className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-2.5 w-5 shrink-0 rounded-full',
        kind === 'intervals' && OPEN_FILL,
        kind === 'breaks' && BREAK_HATCH,
        kind === 'closed' && 'bg-border/60',
        className,
      )}
    />
  );
}
