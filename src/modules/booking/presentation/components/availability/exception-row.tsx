import { Button } from '@components/ui/button';
import { Input, Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import {
  AVAILABILITY_LIMITS,
  EXCEPTION_KINDS,
} from '../../../application/contracts/booking-constraints';
import { openDay } from '../../drafts/availability-plan-form';
import { EXCEPTION_KIND_MESSAGE_KEYS } from '../../messages/message-keys';
import { DatePickerField } from '../shared/date-picker-field';
import { OptionSelectField } from '../shared/option-select-field';

import { DayEditor } from './day-editor';
import { ExceptionPreview } from './exception-preview';

import type { DayForm, ExceptionForm } from '../../drafts/availability-plan-form';

export interface ExceptionRowProps {
  readonly idPrefix: string;
  /** Its place in the plan, shown as its number so a problem named in the summary can be found. */
  readonly number: number;
  readonly exception: ExceptionForm;
  /** The plan's week, which the preview compares the exception with. */
  readonly weekly: readonly DayForm[];
  readonly disabled: boolean;
  readonly isPreviewOpen: boolean;
  /** The translated first problem of a part of this exception (`from`, `to`, `label`, `day`), if it has one. */
  readonly problemAt: (part: string) => string | undefined;
  readonly hasProblem: boolean;
  readonly onChange: (next: ExceptionForm) => void;
  readonly onTogglePreview: () => void;
  readonly onRemove: () => void;
}

interface LabelFieldProps {
  readonly id: string;
  readonly value: string;
  readonly disabled: boolean;
  readonly error: string | undefined;
  readonly onChange: (label: string) => void;
}

function ExceptionLabelField({ id, value, disabled, error, onChange }: LabelFieldProps) {
  const t = useTranslations('booking');

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{t('availability.label')}</Label>
      <Input
        id={id}
        value={value}
        maxLength={AVAILABILITY_LIMITS.maxLabelLength}
        disabled={disabled}
        aria-invalid={error === undefined ? undefined : true}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {error !== undefined && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

/** One exception entered by hand: a closure, different hours, or extra opening. */
export function ExceptionRow({
  idPrefix,
  number,
  exception,
  weekly,
  disabled,
  isPreviewOpen,
  problemAt,
  hasProblem,
  onChange,
  onTogglePreview,
  onRemove,
}: ExceptionRowProps) {
  const t = useTranslations('booking');
  const update = (patch: Partial<ExceptionForm>) => {
    onChange({ ...exception, ...patch });
  };

  return (
    <li
      aria-label={t('exceptions.number', { number })}
      className={cn(
        'space-y-3 rounded-token border p-3',
        hasProblem ? 'border-danger bg-danger-subtle/40' : 'border-border',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-copy">{t('exceptions.number', { number })}</p>
        {hasProblem && (
          <p className="text-xs font-medium text-danger">{t('exceptions.needsAttention')}</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OptionSelectField
          id={`${idPrefix}-kind`}
          label={t('availability.kind')}
          value={exception.kind}
          disabled={disabled}
          options={EXCEPTION_KINDS.map((kind) => ({
            value: kind,
            label: t(EXCEPTION_KIND_MESSAGE_KEYS[kind]),
          }))}
          onValueChange={(kind) => {
            update({ kind, day: kind === 'closed' ? undefined : openDay(exception.day) });
          }}
        />
        <DatePickerField
          id={`${idPrefix}-from`}
          label={t('availability.fromDate')}
          value={exception.from}
          disabled={disabled}
          error={problemAt('from')}
          onChange={(from) => {
            update({ from, to: exception.to === '' || exception.to < from ? from : exception.to });
          }}
        />
        <DatePickerField
          id={`${idPrefix}-to`}
          label={t('availability.toDate')}
          value={exception.to}
          min={exception.from === '' ? undefined : exception.from}
          disabled={disabled}
          error={problemAt('to')}
          onChange={(to) => {
            update({ to });
          }}
        />
        <ExceptionLabelField
          id={`${idPrefix}-label`}
          value={exception.label ?? ''}
          disabled={disabled}
          error={problemAt('label')}
          onChange={(label) => {
            update({ label });
          }}
        />
      </div>
      {exception.kind !== 'closed' && exception.day !== undefined && (
        <DayEditor
          day={exception.day}
          legend={t(
            EXCEPTION_KIND_MESSAGE_KEYS[exception.kind === 'override' ? 'override' : 'additional'],
          )}
          disabled={disabled}
          onChange={(day) => {
            update({ day });
          }}
        />
      )}
      {problemAt('day') !== undefined && (
        <p role="alert" className="text-sm text-danger">
          {problemAt('day')}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={isPreviewOpen}
          onClick={onTogglePreview}
        >
          {isPreviewOpen ? t('exceptions.hidePreview') : t('exceptions.preview')}
        </Button>
        <Button
          type="button"
          variant="destructive-ghost"
          size="sm"
          disabled={disabled}
          onClick={onRemove}
        >
          {t('availability.removeException')}
        </Button>
      </div>
      {isPreviewOpen && <ExceptionPreview exception={exception} weekly={weekly} />}
    </li>
  );
}
