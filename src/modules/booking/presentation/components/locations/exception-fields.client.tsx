'use client';

import { SelectField } from '@components/shared/select-field';

import { useTranslations } from '@i18n/client';

import { withFrom, withKind } from '../../forms/exceptions';
import { errorsUnder } from '../../forms/field-errors';
import { CLOSED_DAY } from '../../forms/week/draft';
import { EXCEPTION_KIND_MESSAGE_KEYS } from '../../messages/message-keys';
import { DateField } from '../shared/date-field.client';
import { DayHoursEditor } from '../shared/day-hours-editor.client';

import type { ExceptionInputDto } from '../../dto/location-dto';

export interface ExceptionFieldsProps {
  readonly exception: ExceptionInputDto;
  /** The messages by path inside the exception (`from`, `day.intervals.0.end`), already translated. */
  readonly errors: Readonly<Record<string, string>>;
  /** The kinds one can choose from; with one only (a blocked period, an absence) the choice is not shown. */
  readonly kinds: ReadonlyArray<ExceptionInputDto['kind']>;
  readonly idPrefix: string;
  readonly onChange: (exception: ExceptionInputDto) => void;
}

/** The fields of one exception: its kind (where there is a choice), the days it covers and, unless it closes, its hours. */
export function ExceptionFields({
  exception,
  errors,
  kinds,
  idPrefix,
  onChange,
}: ExceptionFieldsProps) {
  const t = useTranslations('booking');

  return (
    <>
      {kinds.length > 1 && (
        <SelectField
          id={`${idPrefix}-kind`}
          label={t('exceptions.kindLabel')}
          value={exception.kind}
          options={kinds.map((kind) => ({
            value: kind,
            label: t(EXCEPTION_KIND_MESSAGE_KEYS[kind]),
          }))}
          errorMessage={errors['kind']}
          onValueChange={(next) => {
            const kind = kinds.find((candidate) => candidate === next);
            if (kind !== undefined) {
              onChange(withKind(exception, kind));
            }
          }}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <DateField
          id={`${idPrefix}-from`}
          label={t('exceptions.from')}
          value={exception.from}
          error={errors['from']}
          onValueChange={(value) => {
            onChange(withFrom(exception, value));
          }}
        />
        <DateField
          id={`${idPrefix}-to`}
          label={t('exceptions.to')}
          value={exception.to}
          error={errors['to'] === errors['from'] ? undefined : errors['to']}
          onValueChange={(value) => {
            onChange({ ...exception, to: value });
          }}
        />
      </div>
      {exception.kind !== 'closed' && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-copy">{t('exceptions.hoursOf')}</legend>
          <DayHoursEditor
            day={exception.day ?? CLOSED_DAY}
            name={t('exceptions.hoursOf')}
            idPrefix={`${idPrefix}-day`}
            errors={errorsUnder(errors, 'day')}
            onChange={(day) => {
              onChange({ ...exception, day });
            }}
          />
        </fieldset>
      )}
    </>
  );
}
