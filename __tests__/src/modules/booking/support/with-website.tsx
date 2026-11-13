import type { ReactNode } from 'react';

import { BookingWebsiteProvider } from '@modules/booking/presentation/hooks/use-booking-website';

/** The website every control of a booking screen is rendered in; `BookingAdminPage` provides it in the app. */
export const TEST_WEBSITE = 'site-1';

/** Wraps a client control the way `BookingAdminPage` does, so it can name its website when it calls the server. */
export function inWebsite(ui: ReactNode): ReactNode {
  return <BookingWebsiteProvider websiteId={TEST_WEBSITE}>{ui}</BookingWebsiteProvider>;
}
