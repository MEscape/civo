import { useTranslations } from '@i18n/client';

import { WEEKDAYS } from '../../application/contracts/booking-constraints';
import { EXCEPTION_FIELD_MESSAGE_KEYS } from '../messages/message-keys';

import { useZonedFormat } from './use-zoned-format';

const EXCEPTION_PATH = /(?:^|\.)exceptions\.(\d+)\.(kind|from|to|label|day|holiday)/;
const WEEKDAY_PATH = /(?:^|\.)weekly\.(\d+)(?:\.(intervals|breaks))?/;

function isExceptionField(field: string): field is keyof typeof EXCEPTION_FIELD_MESSAGE_KEYS {
  return Object.hasOwn(EXCEPTION_FIELD_MESSAGE_KEYS, field);
}

/**
 * Says in words where a problem is, for a field path such as
 * `openingHours.exceptions.13.from` ("Exception 14 · From date"). A path that
 * names nothing the form can point at gives `null`: the summary then shows the
 * problem alone rather than a code the visitor cannot read.
 */
export function useFieldPathLabel(): (path: string) => string | null {
  const t = useTranslations('booking');
  const format = useZonedFormat('UTC');

  return (path) => {
    const exception = EXCEPTION_PATH.exec(path);
    const exceptionField = exception?.[2];
    if (exception !== null && exceptionField !== undefined && isExceptionField(exceptionField)) {
      const number = Number(exception[1]) + 1;
      return `${t('form.paths.exception', { number })} · ${t(EXCEPTION_FIELD_MESSAGE_KEYS[exceptionField])}`;
    }
    const weekday = WEEKDAY_PATH.exec(path);
    const weekdayKey = WEEKDAYS[Number(weekday?.[1])];
    if (weekday !== null && weekdayKey !== undefined) {
      const day = format.weekdayName(weekdayKey, 'long');
      return weekday[2] === 'breaks'
        ? t('form.paths.breaksOn', { day })
        : t('form.paths.hoursOn', { day });
    }
    return null;
  };
}
