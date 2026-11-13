'use client';

import { useTranslations } from '@i18n/client';

import { useZonedFormat } from '../../hooks/use-zoned-format';
import { IMPACT_REASON_MESSAGE_KEYS } from '../../messages/message-keys';
import { ImpactReviewDialog } from '../shared/impact-review-dialog.client';

import type { ResourceImpactDto } from '../../dto/resource-dto';

export interface ResourceImpactDialogProps {
  /** The bookings the waiting change reaches, or `null` when nothing waits. */
  readonly impact: ResourceImpactDto | null;
  readonly confirmLabel: string;
  readonly isPending: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /** Where its words are: a change of a resource, or of an employee's calendar. */
  readonly words?: 'resources.block' | 'team.impact' | 'team.leave' | undefined;
}

/** The bookings a change of a resource would leave without it, in the location's own time, and why. */
export function ResourceImpactDialog({
  impact,
  confirmLabel,
  isPending,
  onConfirm,
  onCancel,
  words = 'resources.block',
}: ResourceImpactDialogProps) {
  const t = useTranslations('booking');
  const zoned = useZonedFormat();

  return (
    <ImpactReviewDialog
      open={impact !== null}
      total={impact?.affected.length ?? 0}
      isTruncated={impact?.isTruncated ?? false}
      changes={[]}
      items={(impact?.affected ?? []).map((booking) => ({
        id: booking.bookingId,
        label: `${zoned.longDate(booking.start, booking.timeZone)}, ${zoned.timeRange(booking.start, booking.end, booking.timeZone)}`,
        detail: t(IMPACT_REASON_MESSAGE_KEYS[booking.reason]),
      }))}
      description={t(`${words}.impactDescription`)}
      note={t(`${words}.impactNote`)}
      confirmLabel={confirmLabel}
      isPending={isPending}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
