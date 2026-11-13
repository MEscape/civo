import { AlertTriangle, Check } from '@components/icons/icons';

import { cn } from '@lib/utils';

import type { DayPlanItemDto } from '../../dto/employee-dto';

const LOOK = {
  done: 'border-success bg-success text-primary-foreground',
  missed: 'border-warning bg-warning-subtle text-warning',
  past: 'border-border-strong bg-surface text-copy-muted',
  now: 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/20',
  upcoming: 'border-primary bg-surface text-primary-copy',
} as const satisfies Record<DayPlanItemDto['phase'], string>;

/**
 * The dot of an appointment on the day's timeline (mockup 03): a filled dot for what is on now, a
 * tick for what is done, a ring for what is still to come. It only repeats the state chip beside it,
 * so assistive technology skips it.
 */
export function PlanMarker({ phase }: { readonly phase: DayPlanItemDto['phase'] }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
        LOOK[phase],
      )}
    >
      {phase === 'done' && <Check className="size-3" />}
      {phase === 'missed' && <AlertTriangle className="size-3" />}
    </span>
  );
}
