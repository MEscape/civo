import { useAppFormatters, useTranslations } from '@i18n/client';

import { isDateValue } from '../../application/contracts/map-constraints';

import type { AttributeValue } from '../../application/contracts/map-constraints';

const DATE_ONLY_LENGTH = 10;

/** Formats one attribute for people: locale-aware numbers and dates, translated yes/no. */
export function useAttributeFormat(): (value: AttributeValue) => string {
  const t = useTranslations('map');
  const fmt = useAppFormatters();

  return (value) => {
    if (typeof value === 'number') {
      return fmt.number(value);
    }
    if (typeof value === 'boolean') {
      return value ? t('details.yes') : t('details.no');
    }
    if (isDateValue(value)) {
      return value.length === DATE_ONLY_LENGTH ? fmt.date(value) : fmt.dateTime(value);
    }
    return value;
  };
}
