import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { BookingAreaSkeleton } from '@components/skeletons/booking-area-skeleton';
import { BookingFormPageSkeleton } from '@components/skeletons/booking-form-page-skeleton';
import {
  BookingDetailSkeleton,
  BookingPageSkeleton,
} from '@components/skeletons/booking-page-skeleton';
import { BookingProfileSkeleton } from '@components/skeletons/employee-screens-skeleton';

import en from '@i18n/messages/en.json';

function renderLoading(content: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ app: en }}>
      {content}
    </NextIntlClientProvider>,
  );
}

describe('Booking loading screens', () => {
  it.each([
    ['bookings', 7],
    ['resources', 6],
    ['team', 6],
    ['open', 4],
    ['messages', 4],
  ] as const)(
    'reserves the %s table columns without exposing placeholder data',
    (variant, count) => {
      const { container } = renderLoading(<BookingPageSkeleton variant={variant} />);

      expect(container.querySelectorAll('thead th')).toHaveLength(count);
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
      expect(screen.getAllByRole('status')).toHaveLength(1);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    },
  );

  it.each([
    ['the location picker', () => <BookingAreaSkeleton />],
    ['the create wizard', () => <BookingFormPageSkeleton />],
    ['the one-part edit', () => <BookingFormPageSkeleton steps={0} />],
  ] as const)('announces %s once without exposing decorative controls', (_name, content) => {
    renderLoading(content());

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  // A button beside the heading is drawn only where every viewer has it; a "New …" button depends on
  // the viewer's rights or the data, so it comes with the screen and a placeholder would be a ghost.
  describe("the heading's buttons", () => {
    const buttons = (container: HTMLElement) => container.querySelectorAll('.h-8.w-28').length;

    it.each([
      ['a list', () => <BookingPageSkeleton />, 0],
      ['a service', () => <BookingDetailSkeleton />, 0],
      ["an employee's own calendar", () => <BookingProfileSkeleton />, 0],
      ['a location', () => <BookingDetailSkeleton hasMap actions={2} />, 2],
      ['a team member', () => <BookingProfileSkeleton isManager />, 2],
    ] as const)('draws those of %s as the page has them', (_name, content, count) => {
      const { container } = renderLoading(content());

      expect(buttons(container)).toBe(count);
    });
  });
});
