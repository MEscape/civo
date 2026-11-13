'use client';

import { useTranslations } from '@i18n/client';

import { useImpactSentences } from '../../hooks/use-impact-sentences';
import { useZonedFormat } from '../../hooks/use-zoned-format';
import { IMPACT_REASON_MESSAGE_KEYS } from '../../messages/message-keys';
import { ImpactReviewDialog } from '../shared/impact-review-dialog.client';

import type { PendingImpact } from '../../hooks/use-location-submit';
import type { LocationFormValues } from '../../schemas/location-schema';

export interface LocationImpactDialogProps {
  /** The change that waits to be saved, or `null` when nothing does. */
  readonly impact: PendingImpact | null;
  /** What the form started from, to say what the change is. */
  readonly initial: LocationFormValues;
  readonly isPending: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** The bookings a change of hours would leave outside them, in the location's own time, and the change in words. */
export function LocationImpactDialog({
  impact,
  initial,
  isPending,
  onConfirm,
  onCancel,
}: LocationImpactDialogProps) {
  const t = useTranslations('booking');
  const zoned = useZonedFormat();
  const sentencesOf = useImpactSentences();

  return (
    <ImpactReviewDialog
      open={impact !== null}
      total={impact?.data.affected.length ?? 0}
      isTruncated={impact?.data.isTruncated ?? false}
      changes={impact === null ? [] : sentencesOf(initial, impact.values)}
      items={(impact?.data.affected ?? []).map((booking) => ({
        id: booking.bookingId,
        label: `${zoned.longDate(booking.start, booking.timeZone)}, ${zoned.timeRange(booking.start, booking.end, booking.timeZone)}`,
        detail: t(IMPACT_REASON_MESSAGE_KEYS[booking.reason]),
      }))}
      note={t('impact.note')}
      confirmLabel={t('impact.confirm')}
      isPending={isPending}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
