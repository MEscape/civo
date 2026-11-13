'use client';

import { useTranslations } from '@i18n/client';

import { countsOf } from '../../forms/exceptions';
import { useWeekSummary } from '../../hooks/use-week-summary';
import { ReviewNotes } from '../shared/review-notes.client';
import { SectionOverview } from '../shared/section-overview';

import type { LocationFormValues } from '../../schemas/location-schema';

export interface LocationReviewProps {
  /** Reads the form's values as they are when the review is shown. */
  readonly getValues: () => LocationFormValues;
  readonly onEdit: (section: 'basics' | 'hours' | 'exceptions' | 'services') => void;
  /** How many services of other locations the new location takes over; `null` where the wizard has no such step. */
  readonly offeredCount?: number | null;
}

/**
 * The last step: every part as it will be saved, each with a way back to it, and what is worth
 * knowing before saving. The hints are worked out from the values (a week with no open day), never
 * written in; none of them blocks saving.
 */
export function LocationReview({ getValues, onEdit, offeredCount = null }: LocationReviewProps) {
  const t = useTranslations('booking');
  // Read here, when the review is mounted: see `ResourceReview`.
  const values = getValues();
  const counts = countsOf(values.openingHours.exceptions);
  const summarize = useWeekSummary();
  const hours = summarize(values.openingHours.weekly);
  const hints = [
    ...(values.openingHours.weekly.every((day) => day.intervals.length === 0)
      ? [t('review.hoursNone')]
      : []),
    ...(values.isActive ? [] : [t('review.inactive')]),
  ];
  const action = (section: 'basics' | 'hours' | 'exceptions' | 'services') => ({
    label: t('review.edit'),
    onSelect: () => {
      onEdit(section);
    },
  });

  return (
    <div className="space-y-6">
      <SectionOverview
        label={t('review.rowsLabel')}
        rows={[
          {
            key: 'basics',
            title: t('overview.rows.basics'),
            summary: [
              values.name,
              values.address === '' ? t('overview.noAddress') : values.address,
              values.timeZone,
            ].join(' · '),
            action: action('basics'),
          },
          {
            key: 'hours',
            title: t('overview.rows.hours'),
            summary: hours.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            )),
            action: action('hours'),
          },
          {
            key: 'exceptions',
            title: t('overview.rows.exceptions'),
            summary:
              counts.all === 0
                ? t('overview.exceptionsNone')
                : t('overview.exceptionsSummary', {
                    count: counts.all,
                    holidays: counts.holidays,
                    special: counts.special,
                    closures: counts.closures,
                  }),
            action: action('exceptions'),
          },
          ...(offeredCount === null
            ? []
            : [
                {
                  key: 'services',
                  title: t('overview.rows.services'),
                  summary:
                    offeredCount === 0
                      ? t('form.services.reviewNone')
                      : t('form.services.reviewSome', { count: offeredCount }),
                  action: action('services'),
                },
              ]),
        ]}
      />
      <ReviewNotes notes={hints} />
    </div>
  );
}
