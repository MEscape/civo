'use client';

import { useTranslations } from '@i18n/client';

import { useWeekSummary } from '../../hooks/use-week-summary';
import { RESOURCE_TYPE_MESSAGE_KEYS } from '../../messages/message-keys';
import { RESOURCE_KIND_FILTERS } from '../../schemas/parse-resource-list-input';
import { ReviewNotes } from '../shared/review-notes.client';
import { SectionOverview } from '../shared/section-overview';

import type { ResourcePartKey } from '../../forms/resource-steps';
import type { ResourceFormValues } from '../../schemas/resource-schema';

export interface ResourceReviewProps {
  /** Reads the form's values as they are when the review is shown (see the note below). */
  readonly getValues: () => ResourceFormValues;
  /** How many services use it; nothing for a new resource. */
  readonly usedBy: number;
  readonly onEdit: (part: ResourcePartKey) => void;
}

/**
 * The last step: every part as it will be saved, each with a way back to it, and what is worth
 * knowing first (no service uses it yet). Nothing here blocks saving.
 */
export function ResourceReview({ getValues, usedBy, onEdit }: ResourceReviewProps) {
  const t = useTranslations('booking');
  // Read here, in the review itself, and not by the form that shows it: the review is mounted each time it
  // is reached, so it reads what was typed since. A call made by the form on every render is remembered by
  // the compiler for as long as `form` is the same object, i.e. as the empty form it started as.
  const values = getValues();
  const summarize = useWeekSummary();
  const kind = RESOURCE_KIND_FILTERS.find((key) => key === values.type);
  const action = (part: ResourcePartKey) => ({
    label: t('resources.overview.edit'),
    onSelect: () => {
      onEdit(part);
    },
  });
  const blocks = values.openingHours.exceptions.length;

  return (
    <div className="space-y-6">
      <SectionOverview
        label={t('resources.overview.sectionsLabel')}
        rows={[
          {
            key: 'basics',
            title: t('resources.overview.rows.basics'),
            summary: [
              values.name,
              kind === undefined ? values.type : t(RESOURCE_TYPE_MESSAGE_KEYS[kind]),
              t('resources.overview.places', { count: values.capacity }),
              t('resources.overview.setup', { minutes: values.setupMinutes }),
              t('resources.overview.teardown', { minutes: values.teardownMinutes }),
            ].join(' · '),
            action: action('basics'),
          },
          {
            key: 'availability',
            title: t('resources.overview.rows.availability'),
            summary: [
              values.followsLocation
                ? t('resources.overview.followsLocation')
                : `${t('resources.overview.ownHours')}: ${summarize(values.openingHours.weekly).join(', ')}`,
              blocks === 0
                ? t('resources.overview.blocksNone')
                : t('resources.overview.blocksCount', { count: blocks }),
            ].join(' · '),
            action: action('availability'),
          },
        ]}
      />
      <ReviewNotes notes={usedBy === 0 ? [t('resources.form.notUsed')] : []} />
    </div>
  );
}
