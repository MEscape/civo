import { cn } from '@lib/utils';

const PERCENT = 100;

export interface ProgressBarProps {
  readonly value: number;
  readonly max: number;
  /** What is being counted, for assistive technology ("3 of 4 steps done"). */
  readonly label: string;
  readonly className?: string;
}

/** How far along something is, as a thin bar. The numbers belong beside it in words: the bar is not the only signal. */
export function ProgressBar({ value, max, label, className }: ProgressBarProps) {
  const share = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-canvas', className)}
    >
      <div
        className="h-full rounded-full bg-success transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${share * PERCENT}%` }}
      />
    </div>
  );
}
