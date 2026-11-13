'use client';

import { Calendar } from '@components/icons/icons';
import { TextField } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useDateField } from '../../hooks/use-date-field';
import { MonthCalendar } from '../public/month-calendar.client';

export interface DateFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value?: string | undefined;
  readonly defaultValue?: string | undefined;
  readonly name?: string | undefined;
  readonly error?: string | undefined;
  readonly disabled?: boolean | undefined;
  /** The label is read out, not shown: the field sits in a strip of controls. */
  readonly isLabelHidden?: boolean | undefined;
  /** What the empty field shows; the date format by default. */
  readonly placeholder?: string | undefined;
  readonly min?: string | undefined;
  readonly max?: string | undefined;
  readonly onValueChange?: ((value: string) => void) | undefined;
}

/** A named ISO date field with the booking calendar, manual entry and an accessible disclosure. */
export function DateField(props: DateFieldProps) {
  const t = useTranslations('booking');
  const {
    rootRef,
    buttonRef,
    panelId,
    isOpen,
    value,
    month,
    chosenDay,
    firstDay,
    lastDay,
    freeDays,
    change,
    setMonth,
    toggle,
    choose,
  } = useDateField(props);
  return (
    <div ref={rootRef} className="relative min-w-0">
      <TextField
        id={props.id}
        label={props.label}
        isLabelHidden={props.isLabelHidden === true}
        name={props.name}
        type="text"
        autoComplete="off"
        placeholder={props.placeholder ?? 'YYYY-MM-DD'}
        value={value}
        error={props.error}
        disabled={props.disabled}
        className="pe-11"
        onChange={(event) => {
          change(event.target.value);
        }}
      />
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        // The button sits on the input: below the label when there is one, at the top of the wrapper when the label is hidden.
        className={`absolute end-1 ${props.isLabelHidden === true ? 'top-0.5' : 'top-7'}`}
        aria-label={t('workspace.openCalendar', { field: props.label })}
        aria-expanded={isOpen}
        aria-controls={panelId}
        disabled={props.disabled}
        onClick={toggle}
      >
        <Calendar aria-hidden="true" className="size-4" />
      </Button>
      {isOpen && (
        <div
          id={panelId}
          role="region"
          aria-label={props.label}
          className="fixed start-0 top-0 z-50 w-80 max-w-[calc(100vw-1rem)] rounded-token border border-border bg-surface p-3 shadow-lg"
        >
          <MonthCalendar
            month={month}
            today={firstDay}
            lastDay={lastDay}
            freeDays={freeDays}
            chosenDay={chosenDay}
            disabled={props.disabled ?? false}
            onChoose={choose}
            onMonth={setMonth}
            availabilityHints={false}
          />
        </div>
      )}
    </div>
  );
}
