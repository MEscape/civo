import { Button } from '@components/ui/button';
import { Input, Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import {
  AVAILABILITY_LIMITS,
  EXCEPTION_KINDS,
} from '../../../application/contracts/booking-constraints';
import { openDay } from '../../drafts/availability-plan-form';
import { EXCEPTION_KIND_MESSAGE_KEYS } from '../../messages/message-keys';
import { OptionSelectField } from '../shared/option-select-field';

import { DayEditor } from './day-editor';

import type { ExceptionForm } from '../../drafts/availability-plan-form';

export interface ExceptionRowProps {
  readonly idPrefix: string;
  readonly exception: ExceptionForm;
  readonly disabled: boolean;
  readonly onChange: (next: ExceptionForm) => void;
  readonly onRemove: () => void;
}

/** One dated exception: a closure, different hours, or extra opening. */
export function ExceptionRow({
  idPrefix,
  exception,
  disabled,
  onChange,
  onRemove,
}: ExceptionRowProps) {
  const t = useTranslations('booking');
  const update = (patch: Partial<ExceptionForm>) => {
    onChange({ ...exception, ...patch });
  };

  return (
    <li className="space-y-3 rounded-token border border-border p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-from`}>{t('availability.fromDate')}</Label>
          <Input
            id={`${idPrefix}-from`}
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
          <Label htmlFor={`${idPrefix}-to`}>{t('availability.toDate')}</Label>
          <Input
            id={`${idPrefix}-to`}
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
          <Label htmlFor={`${idPrefix}-label`}>{t('availability.label')}</Label>
          <Input
            id={`${idPrefix}-label`}
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
            EXCEPTION_KIND_MESSAGE_KEYS[exception.kind === 'override' ? 'override' : 'additional'],
          )}
          disabled={disabled}
          onChange={(day) => {
            update({ day });
          }}
        />
      )}
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
        {t('availability.removeException')}
      </Button>
    </li>
  );
}
