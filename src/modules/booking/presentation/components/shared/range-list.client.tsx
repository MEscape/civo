'use client';

import { useTranslations } from '@i18n/client';

import { removeAt, replaceAt } from '@lib/utils';

import { TimeRangeRow } from './time-range-row.client';

import type { RangeDto } from '../../dto/location-dto';
import type { RangeKind } from '../../forms/week/change-range';

export interface RangeListProps {
  readonly kind: RangeKind;
  readonly ranges: readonly RangeDto[];
  readonly onChange: (ranges: RangeDto[]) => void;
  /** What the day is called in the labels ("Monday", "the exception"). */
  readonly dayName: string;
  readonly idPrefix: string;
  /** The messages of this day's fields, by path inside the day (`intervals.0.end`), already translated. */
  readonly errors: Readonly<Record<string, string>>;
  readonly disabled: boolean;
}

/** The opening ranges of a day, or its breaks: the same rows with their own words. */
export function RangeList({
  kind,
  ranges,
  onChange,
  dayName,
  idPrefix,
  errors,
  disabled,
}: RangeListProps) {
  const t = useTranslations('booking');
  const isBreak = kind === 'breaks';
  const kindWord = isBreak ? t('hours.kindBreak') : t('hours.kindOpen');

  return ranges.map((range, index) => {
    const words = { day: dayName, n: index + 1 };
    return (
      <TimeRangeRow
        // The rows have no identity of their own; their place in the list is it.
        // eslint-disable-next-line react/no-array-index-key -- editable rows without ids
        key={`${kind}-${index}`}
        range={range}
        kind={kind}
        kindLabel={
          ranges.length > 1 ? t('hours.rangeNamed', { kind: kindWord, n: index + 1 }) : kindWord
        }
        id={`${idPrefix}-${isBreak ? 'b' : 'i'}${index}`}
        startLabel={isBreak ? t('hours.breakStart', words) : t('hours.intervalStart', words)}
        endLabel={isBreak ? t('hours.breakEnd', words) : t('hours.intervalEnd', words)}
        removeLabel={isBreak ? t('hours.removeBreak', words) : t('hours.removeInterval', words)}
        startError={errors[`${kind}.${index}.start`]}
        endError={errors[`${kind}.${index}.end`]}
        disabled={disabled}
        onChange={(next) => {
          onChange(replaceAt(ranges, index, next));
        }}
        onRemove={() => {
          onChange(removeAt(ranges, index));
        }}
      />
    );
  });
}
