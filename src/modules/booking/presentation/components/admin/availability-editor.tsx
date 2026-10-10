'use client';

import { useId } from 'react';

import { Button } from '@components/ui/button';
import { Input, Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import {
  AVAILABILITY_LIMITS,
  EXCEPTION_KINDS,
  WEEKDAYS,
} from '../../../application/contracts/booking-constraints';
import { useZonedFormat } from '../../hooks/use-zoned-format';
import { EXCEPTION_KIND_MESSAGE_KEYS } from '../../messages/message-keys';
import { SelectField } from '../shared/select-field';

import type { AvailabilityPlanForm } from '../../schemas/availability-plan-schema';

type DayForm = AvailabilityPlanForm['weekly'][number];
type RangeForm = DayForm['intervals'][number];
type ExceptionForm = AvailabilityPlanForm['exceptions'][number];

const DEFAULT_RANGE: RangeForm = { start: '09:00', end: '17:00' };
const DEFAULT_BREAK: RangeForm = { start: '12:00', end: '13:00' };
const WORKING_WEEKDAYS = 5;

/** An empty plan: closed all week, no exceptions. */
export const EMPTY_PLAN: AvailabilityPlanForm = {
  weekly: WEEKDAYS.map(() => ({ intervals: [], breaks: [] })),
  exceptions: [],
};

export interface AvailabilityEditorProps {
  readonly value: AvailabilityPlanForm;
  readonly onChange: (next: AvailabilityPlanForm) => void;
  readonly disabled?: boolean;
}

function replaceAt<T>(list: readonly T[], index: number, item: T): T[] {
  return list.map((existing, position) => (position === index ? item : existing));
}

function removeAt<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, position) => position !== index);
}

interface RangeListProps {
  readonly legend: string;
  readonly addLabel: string;
  readonly ranges: readonly RangeForm[];
  readonly max: number;
  readonly defaultRange: RangeForm;
  readonly disabled: boolean;
  readonly onChange: (next: RangeForm[]) => void;
}

/** A list of `from - to` times. Each row is a pair of native time inputs, which phones render as a picker. */
function RangeList({
  legend,
  addLabel,
  ranges,
  max,
  defaultRange,
  disabled,
  onChange,
}: RangeListProps) {
  const t = useTranslations('booking');
  const id = useId();

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-copy-muted">{legend}</legend>
      {ranges.map((range, index) => (
        // The list is edited by position, so the position is the identity.
        // eslint-disable-next-line react/no-array-index-key -- rows are edited by position
        <div key={`${id}-${index}`} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`${id}-${index}-start`} className="text-xs">
              {t('availability.from')}
            </Label>
            <Input
              id={`${id}-${index}-start`}
              type="time"
              step={300}
              value={range.start}
              disabled={disabled}
              onChange={(event) => {
                onChange(replaceAt(ranges, index, { ...range, start: event.target.value }));
              }}
              className="w-32"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-${index}-end`} className="text-xs">
              {t('availability.to')}
            </Label>
            <Input
              id={`${id}-${index}-end`}
              type="time"
              step={300}
              value={range.end}
              disabled={disabled}
              onChange={(event) => {
                onChange(replaceAt(ranges, index, { ...range, end: event.target.value }));
              }}
              className="w-32"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => {
              onChange(removeAt(ranges, index));
            }}
          >
            {t('availability.remove')}
            <span className="sr-only">{legend}</span>
          </Button>
        </div>
      ))}
      {ranges.length < max && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            onChange([...ranges, defaultRange]);
          }}
        >
          {addLabel}
        </Button>
      )}
    </fieldset>
  );
}

interface DayEditorProps {
  readonly day: DayForm;
  readonly legend: string;
  readonly disabled: boolean;
  readonly onChange: (next: DayForm) => void;
}

function DayEditor({ day, legend, disabled, onChange }: DayEditorProps) {
  const t = useTranslations('booking');
  return (
    <div className="space-y-3">
      <RangeList
        legend={t('availability.hoursFor', { day: legend })}
        addLabel={t('availability.addHours')}
        ranges={day.intervals}
        max={AVAILABILITY_LIMITS.maxRangesPerDay}
        defaultRange={DEFAULT_RANGE}
        disabled={disabled}
        onChange={(intervals) => {
          onChange({ ...day, intervals });
        }}
      />
      {day.intervals.length > 0 && (
        <RangeList
          legend={t('availability.breaksFor', { day: legend })}
          addLabel={t('availability.addBreak')}
          ranges={day.breaks}
          max={AVAILABILITY_LIMITS.maxBreaksPerDay}
          defaultRange={DEFAULT_BREAK}
          disabled={disabled}
          onChange={(breaks) => {
            onChange({ ...day, breaks });
          }}
        />
      )}
    </div>
  );
}

/**
 * Edits one availability plan: the weekly pattern with breaks, and dated
 * exceptions (closures, one-off changes, extra openings). The same editor
 * serves a location's opening hours, a resource's working time and a
 * service's own restrictions, because they are the same kind of plan.
 */
export function AvailabilityEditor({ value, onChange, disabled = false }: AvailabilityEditorProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat('UTC');

  function copyFirstDayToWeekdays() {
    const [first] = value.weekly;
    if (first === undefined) {
      return;
    }
    onChange({
      ...value,
      weekly: value.weekly.map((day, index) => (index < WORKING_WEEKDAYS ? first : day)),
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-copy">{t('availability.weekly')}</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={copyFirstDayToWeekdays}
          >
            {t('availability.copyMonday')}
          </Button>
        </div>
        <ul className="space-y-3">
          {WEEKDAYS.map((weekday, index) => {
            const day = value.weekly[index] ?? { intervals: [], breaks: [] };
            const name = format.weekdayName(weekday, 'long');
            return (
              <li key={weekday} className="rounded-token border border-border p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                  <p className="text-sm font-medium text-copy">{name}</p>
                  {day.intervals.length === 0 && (
                    <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
                      <p className="text-sm text-copy-muted">{t('availability.closed')}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={() => {
                          onChange({
                            ...value,
                            weekly: replaceAt(value.weekly, index, {
                              ...day,
                              intervals: [DEFAULT_RANGE],
                            }),
                          });
                        }}
                      >
                        {t('availability.addHours')}
                        <span className="sr-only">{name}</span>
                      </Button>
                    </div>
                  )}
                  {day.intervals.length > 0 && (
                    <div className="sm:col-span-3">
                      <DayEditor
                        day={day}
                        legend={name}
                        disabled={disabled}
                        onChange={(next) => {
                          onChange({ ...value, weekly: replaceAt(value.weekly, index, next) });
                        }}
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <ExceptionsEditor
        exceptions={value.exceptions}
        disabled={disabled}
        onChange={(exceptions) => {
          onChange({ ...value, exceptions });
        }}
      />
    </div>
  );
}

interface ExceptionsEditorProps {
  readonly exceptions: readonly ExceptionForm[];
  readonly disabled: boolean;
  readonly onChange: (next: ExceptionForm[]) => void;
}

const DEFAULT_EXCEPTION: ExceptionForm = {
  kind: 'closed',
  from: '',
  to: '',
  label: '',
};

function ExceptionsEditor({ exceptions, disabled, onChange }: ExceptionsEditorProps) {
  const t = useTranslations('booking');
  const id = useId();

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium text-copy">{t('availability.exceptions')}</h4>
        <p className="text-xs text-copy-muted">{t('availability.exceptionsHint')}</p>
      </div>
      {exceptions.length === 0 && (
        <p className="text-sm text-copy-muted">{t('availability.noExceptions')}</p>
      )}
      <ul className="space-y-3">
        {exceptions.map((exception, index) => {
          const prefix = `${id}-${index}`;
          const update = (patch: Partial<ExceptionForm>) => {
            onChange(replaceAt(exceptions, index, { ...exception, ...patch }));
          };
          return (
            // eslint-disable-next-line react/no-array-index-key -- rows are edited by position
            <li key={prefix} className="space-y-3 rounded-token border border-border p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <SelectField
                  id={`${prefix}-kind`}
                  label={t('availability.kind')}
                  value={exception.kind}
                  disabled={disabled}
                  options={EXCEPTION_KINDS.map((kind) => ({
                    value: kind,
                    label: t(EXCEPTION_KIND_MESSAGE_KEYS[kind]),
                  }))}
                  onValueChange={(kind) => {
                    update({
                      kind,
                      day:
                        kind === 'closed'
                          ? undefined
                          : (exception.day ?? { intervals: [DEFAULT_RANGE], breaks: [] }),
                    });
                  }}
                />
                <div className="space-y-1.5">
                  <Label htmlFor={`${prefix}-from`}>{t('availability.fromDate')}</Label>
                  <Input
                    id={`${prefix}-from`}
                    type="date"
                    value={exception.from}
                    disabled={disabled}
                    onChange={(event) => {
                      update({
                        from: event.target.value,
                        to: exception.to === '' ? event.target.value : exception.to,
                      });
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${prefix}-to`}>{t('availability.toDate')}</Label>
                  <Input
                    id={`${prefix}-to`}
                    type="date"
                    value={exception.to}
                    min={exception.from}
                    disabled={disabled}
                    onChange={(event) => {
                      update({ to: event.target.value });
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${prefix}-label`}>{t('availability.label')}</Label>
                  <Input
                    id={`${prefix}-label`}
                    value={exception.label ?? ''}
                    maxLength={AVAILABILITY_LIMITS.maxLabelLength}
                    disabled={disabled}
                    onChange={(event) => {
                      update({ label: event.target.value });
                    }}
                  />
                </div>
              </div>
              {exception.kind !== 'closed' && exception.day !== undefined && (
                <DayEditor
                  day={exception.day}
                  legend={t(
                    EXCEPTION_KIND_MESSAGE_KEYS[
                      exception.kind === 'override' ? 'override' : 'additional'
                    ],
                  )}
                  disabled={disabled}
                  onChange={(day) => {
                    update({ day });
                  }}
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  onChange(removeAt(exceptions, index));
                }}
              >
                {t('availability.removeException')}
              </Button>
            </li>
          );
        })}
      </ul>
      {exceptions.length < AVAILABILITY_LIMITS.maxExceptions && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            onChange([...exceptions, DEFAULT_EXCEPTION]);
          }}
        >
          {t('availability.addException')}
        </Button>
      )}
    </div>
  );
}
