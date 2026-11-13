import { Calendar } from '@components/icons/icons';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { BookingEmptyState } from '../shared/booking-empty-state';

import type { BookingMay } from '../../loaders/booking-readers';

export interface EmployeeScreenProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly may: BookingMay;
}

export async function NoCalendar({ locale }: { readonly locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  return (
    <BookingEmptyState
      icon={<Calendar aria-hidden="true" />}
      scope="page"
      title={t('employee.noCalendar.title')}
      description={t('employee.noCalendar.description')}
    />
  );
}
