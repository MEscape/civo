import { buttonVariants } from '@components/ui/button';
import { ContentLink } from '@components/ui/content-link';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { BOOKING_MANAGE_PARAM, BOOKING_SECTION_ANCHOR } from '../../routes';

import { BookingSummary } from './booking-summary';
import { ChangeRules } from './change-rules';

import type { PublicBookingDto } from '../../dto/booking-dto';

/**
 * The booking is made: its number, the time on the location's clock, the place, what may still be
 * changed until when, and the link that opens it again on this page (the one the e-mail carries).
 */
export function ConfirmationPanel({ booking }: { readonly booking: PublicBookingDto }) {
  const t = useTranslations('booking');
  const manageHref = `?${BOOKING_MANAGE_PARAM}=${encodeURIComponent(booking.reference)}#${BOOKING_SECTION_ANCHOR}`;

  return (
    <div className="space-y-5">
      <p role="status" className="text-base text-copy">
        {t('public.done.mail')} {t('public.done.reference')}
      </p>
      <BookingSummary booking={booking} showReference />
      <ChangeRules booking={booking} />
      <ContentLink
        href={manageHref}
        className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'min-h-11')}
      >
        {t('public.done.manage')}
      </ContentLink>
    </div>
  );
}
