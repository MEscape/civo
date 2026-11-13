'use client';

import { useTranslations } from '@i18n/client';

import { isDefined } from '@lib/utils';

import { SERVICE_PARTS } from '../../forms/service-steps';
import { ReviewNotes } from '../shared/review-notes.client';

import { ServiceSummaryRows } from './service-summary-rows.client';

import type { ResourceOptionDto } from '../../dto/service-dto';
import type { ServicePartKey } from '../../forms/service-steps';
import type { ServiceFormValues } from '../../schemas/service-schema';

export interface ServiceReviewProps {
  /** Reads the form's values as they are when the review is shown. */
  readonly getValues: () => ServiceFormValues;
  readonly resources: readonly ResourceOptionDto[];
  readonly onEdit: (part: ServicePartKey) => void;
  /** The service exists already: what is said about saving is not "bookable immediately". */
  readonly isExisting: boolean;
}

/**
 * The last step: every part as it will be saved, each with a way back to it, and what is worth
 * knowing before saving. The hints are worked out from the values (online bookability, a
 * reservation with nothing to reserve), never written in; none of them blocks saving.
 */
export function ServiceReview({ getValues, resources, onEdit, isExisting }: ServiceReviewProps) {
  const t = useTranslations('booking');
  // Read here, when the review is mounted: see `ResourceReview`.
  const values = getValues();
  const needsNothing =
    values.employee === 'none' && !values.resources.some((link) => link.isRequired);
  const hints = [
    values.isOnlineBookable && values.isActive && !isExisting
      ? t('services.review.immediate')
      : null,
    !values.isOnlineBookable ? t('services.review.notOnline') : null,
    !values.isActive ? t('services.review.inactive') : null,
    needsNothing ? t('services.review.nothingReserved') : null,
  ].filter(isDefined);

  return (
    <div className="space-y-6">
      <ServiceSummaryRows
        label={t('services.review.rowsLabel')}
        // Without resources to choose from the wizard has no such step, so no row to go back to.
        parts={
          resources.length > 0
            ? SERVICE_PARTS
            : SERVICE_PARTS.filter((part) => part !== 'resources')
        }
        values={values}
        resources={resources}
        action={{ onSelect: onEdit }}
      />
      <ReviewNotes notes={hints} />
    </div>
  );
}
