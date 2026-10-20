import { cn } from '@lib/utils';

const PERCENT = 100;

export interface ProgressBarProps {
  readonly value: number;
  readonly max: number;
  /** What is being counted, for assistive technology ("3 of 4 steps done"). */
  readonly label: string;
  readonly className?: string;
}

/**
 * How far along something is, as a thin bar. The numbers belong beside it in
 * words: the bar is not the only signal.
 *
 * Deliberately not shadcn's `Progress`: that is `@radix-ui/react-progress`, a
 * dependency that adds only the same `role="progressbar"` attributes written
 * here, plus an indeterminate state nothing needs. The look comes from the
 * design tokens (`bg-canvas` track, `bg-success` fill). A value outside
 * `0..max` is announced clamped, since ARIA does not allow it.
 */
export function ProgressBar({ value, max, label, className }: ProgressBarProps) {
  const safeMax = Math.max(0, max);
  const safeValue = Math.min(safeMax, Math.max(0, value));
  const share = safeMax === 0 ? 0 : safeValue / safeMax;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-canvas', className)}
    >
      <div
        className="h-full rounded-full bg-success transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${share * PERCENT}%` }}
      />
    </div>
  );
}
