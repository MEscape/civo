import { BookingOverviewCard } from '@modules/booking';

import { loadBookingSummary } from '@/app/_lib/booking-summary';
import { orNull } from '@/app/_lib/or-fail';
import { getWebsiteAccess } from '@/app/_lib/website-access';

import type { BlockProps } from './block-props';

export async function BookingBlock({ websiteId, locale }: BlockProps) {
  const access = await getWebsiteAccess();
  if (!access.maySection('bookings')) {
    return null;
  }
  const summary = await orNull(loadBookingSummary(websiteId));

  return summary === null ? null : (
    <BookingOverviewCard websiteId={websiteId} locale={locale} summary={summary} />
  );
}
