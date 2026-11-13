import { useTranslations } from '@i18n/client';

import { deepEqual } from '@lib/utils';

import { weekdayId } from '../forms/week/draft';
import { dayFacts } from '../forms/week/facts';

import type { DayFact } from '../forms/week/facts';
import type { LocationFormValues } from '../schemas/location-schema';

/**
 * The words for what a change of hours does, made from the data: "Friday will close at 14:00
 * instead of 16:00", never typed by hand. A change of the exceptions is said in one sentence.
 */
export function useImpactSentences() {
  const t = useTranslations('booking');

  const sentenceOf = (fact: DayFact): string => {
    const day = t(`weekdays.long.${weekdayId(fact.weekday)}`);
    switch (fact.kind) {
      case 'closed':
        return t('impact.closed', { day });
      case 'opened':
        return t('impact.opened', { day, to: fact.to });
      case 'other':
        return t('impact.other', { day });
      case 'opensEarlier':
        return t('impact.opensEarlier', { day, from: fact.from, to: fact.to });
      case 'opensLater':
        return t('impact.opensLater', { day, from: fact.from, to: fact.to });
      case 'closesEarlier':
        return t('impact.closesEarlier', { day, from: fact.from, to: fact.to });
      case 'closesLater':
        return t('impact.closesLater', { day, from: fact.from, to: fact.to });
    }
  };

  return (before: LocationFormValues, after: LocationFormValues): string[] => {
    const facts = dayFacts(before.openingHours.weekly, after.openingHours.weekly).map(sentenceOf);
    return deepEqual(before.openingHours.exceptions, after.openingHours.exceptions)
      ? facts
      : [...facts, t('impact.exceptionsChanged')];
  };
}
