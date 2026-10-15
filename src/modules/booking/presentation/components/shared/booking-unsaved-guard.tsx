'use client';

import type { ReactNode } from 'react';

import { UnsavedChangesGuard } from '@components/shared/unsaved-changes-guard';

import { useTranslations } from '@i18n/client';

/**
 * The booking screens' one guard against leaving with unsaved work: the
 * location hours, a service, a resource, a team member and an employee's own
 * week each report into it.
 */
export function BookingUnsavedGuard({ children }: { readonly children: ReactNode }) {
  const t = useTranslations('booking');

  return (
    <UnsavedChangesGuard
      title={t('leave.title')}
      description={t('leave.description')}
      confirmLabel={t('leave.confirm')}
      cancelLabel={t('leave.stay')}
    >
      {children}
    </UnsavedChangesGuard>
  );
}
