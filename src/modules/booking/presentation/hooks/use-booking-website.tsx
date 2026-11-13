'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

const BookingWebsiteContext = createContext<string | null>(null);

/**
 * The website a booking screen works in, handed down once by `BookingAdminPage` so every control
 * that changes something names it when it calls the server. Display state only: each use case
 * authorizes the website again, so a forged id gets a refusal and nothing else.
 */
export function BookingWebsiteProvider({
  websiteId,
  children,
}: {
  readonly websiteId: string;
  readonly children: ReactNode;
}) {
  return <BookingWebsiteContext value={websiteId}>{children}</BookingWebsiteContext>;
}

/** The website of the screen the control sits on. */
export function useBookingWebsite(): string {
  const websiteId = useContext(BookingWebsiteContext);
  if (websiteId === null) {
    throw new Error('A booking control was rendered outside BookingAdminPage.');
  }
  return websiteId;
}
