import { HoursSwatch } from './hours-swatch';

/** What the bar's colours mean, once under a whole week of them. */
export function DayTimelineLegend({
  open,
  closed,
  breakLabel,
}: {
  readonly open: string;
  readonly closed: string;
  readonly breakLabel: string;
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-copy-muted">
      <li className="flex items-center gap-1.5">
        <HoursSwatch kind="intervals" />
        {open}
      </li>
      <li className="flex items-center gap-1.5">
        <HoursSwatch kind="breaks" />
        {breakLabel}
      </li>
      <li className="flex items-center gap-1.5">
        <HoursSwatch kind="closed" />
        {closed}
      </li>
    </ul>
  );
}
