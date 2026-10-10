import { Button } from '@components/ui/button';
import { Icons } from '@components/ui/icons';

import { CALENDAR_VIEWS } from '../../calendar/calendar-model';

import type { CalendarLabels, CalendarViewName } from '../../calendar/calendar-model';

export interface CalendarToolbarProps {
  readonly title: string;
  readonly labels: CalendarLabels;
  readonly view: CalendarViewName;
  readonly onPrevious: () => void;
  readonly onToday: () => void;
  readonly onNext: () => void;
  readonly onViewChange: (view: CalendarViewName) => void;
}

/** Paging and the view switch above the calendar; the library's own toolbar is off. */
export function CalendarToolbar({
  title,
  labels,
  view,
  onPrevious,
  onToday,
  onNext,
  onViewChange,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrevious}
          aria-label={labels.previous}
        >
          <Icons.chevronLeft aria-hidden="true" />
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onToday}>
          {labels.today}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onNext} aria-label={labels.next}>
          <Icons.chevronRight aria-hidden="true" />
        </Button>
      </div>
      <h3 className="text-base font-medium text-copy" aria-live="polite">
        {title}
      </h3>
      <div role="group" aria-label={labels.viewGroup} className="flex gap-1">
        {CALENDAR_VIEWS.map((name) => (
          <Button
            key={name}
            type="button"
            size="sm"
            variant={view === name ? 'default' : 'outline'}
            aria-pressed={view === name}
            onClick={() => {
              onViewChange(name);
            }}
          >
            {labels.views[name]}
          </Button>
        ))}
      </div>
    </div>
  );
}
