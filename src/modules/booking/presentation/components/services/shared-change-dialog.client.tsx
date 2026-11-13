'use client';

import { ConfirmDialog } from '@components/shared/dialog';

import { useTranslations } from '@i18n/client';

import type { LocationNameDto } from '../../dto/service-dto';
import type { PendingShared } from '../../hooks/use-service-submit';

export interface SharedChangeDialogProps {
  /** The change that waits to be saved, or `null` when nothing does. */
  readonly pending: PendingShared | null;
  /** The other locations that have the service on, from the real data. */
  readonly sharedWith: readonly LocationNameDto[];
  readonly isPending: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * Asked before a change to a service that other locations have on: it reaches them too, and this
 * says how many places and which, from the data. Bookings that exist keep what they were made with.
 */
export function SharedChangeDialog({
  pending,
  sharedWith,
  isPending,
  onConfirm,
  onCancel,
}: SharedChangeDialogProps) {
  const t = useTranslations('booking');
  const places = sharedWith.length + 1;

  return (
    <ConfirmDialog
      open={pending !== null}
      confirmVariant="default"
      title={t('services.shared.title', { count: places })}
      description={t('services.shared.description', {
        names: sharedWith.map((place) => place.name).join(', '),
      })}
      confirmLabel={t('services.shared.confirm')}
      cancelLabel={t('services.shared.cancel')}
      isPending={isPending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p className="text-sm text-copy">{t('services.shared.bookings')}</p>
    </ConfirmDialog>
  );
}
