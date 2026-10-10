'use client';

import { useState } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { BookingSummary } from './booking-summary';
import { buildCalendarFile } from './calendar-file';

import type { BookingDto } from '../../dto/booking-dto';

export interface ConfirmationPanelProps {
  readonly booking: BookingDto;
  readonly showParticipants: boolean;
  readonly onManage: () => void;
  readonly onBookAnother: () => void;
}

type CopyState = 'idle' | 'copied' | 'failed';

function downloadCalendarFile(booking: BookingDto): void {
  const content = buildCalendarFile(
    {
      uid: booking.reference,
      title: booking.serviceName,
      start: booking.start,
      end: booking.end,
      location: [booking.locationName, booking.locationAddress]
        .filter((part) => part !== null)
        .join(', '),
      description: booking.instructions,
    },
    new Date(),
  );
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${booking.reference}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The booking is made. The reference is shown large and can be copied; we do
 * not claim a message was sent, because the module sends none: the visitor
 * is told to keep the reference and the address they entered, which are what
 * the "manage my booking" page asks for.
 */
export function ConfirmationPanel({
  booking,
  showParticipants,
  onManage,
  onBookAnother,
}: ConfirmationPanelProps) {
  const t = useTranslations('booking');
  const [copy, setCopy] = useState<CopyState>('idle');

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(booking.reference);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-token border border-success-border bg-success-subtle p-4">
        <p className="text-sm text-success">{t('confirmation.referenceLabel')}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <p className="font-mono text-2xl font-semibold tracking-wider text-success">
            {booking.reference}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyReference()}>
            {t('confirmation.copy')}
          </Button>
          <span role="status" className="text-sm text-success">
            {copy === 'copied' && t('confirmation.copied')}
            {copy === 'failed' && t('confirmation.copyFailed')}
          </span>
        </div>
      </div>

      <BookingSummary
        serviceName={booking.serviceName}
        locationName={booking.locationName}
        locationAddress={booking.locationAddress}
        timeZone={booking.timeZone}
        localDate={booking.localDate}
        localTime={booking.localTime}
        participants={booking.participants}
        showParticipants={showParticipants}
      />

      <p className="text-sm text-copy">
        {t('confirmation.keepSafe', { email: booking.email ?? '' })}
      </p>

      {booking.requiredDocuments.length > 0 && (
        <section className="space-y-2" aria-labelledby="confirmation-documents">
          <h4 id="confirmation-documents" className="text-sm font-medium text-copy">
            {t('details.documents')}
          </h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-copy">
            {booking.requiredDocuments.map((document) => (
              <li key={document}>{document}</li>
            ))}
          </ul>
        </section>
      )}

      {booking.instructions !== null && (
        <aside className="rounded-token border border-info-border bg-info-subtle p-4 text-sm text-info">
          <p className="whitespace-pre-line">{booking.instructions}</p>
        </aside>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            downloadCalendarFile(booking);
          }}
        >
          {t('confirmation.addToCalendar')}
        </Button>
        {booking.canCancel || booking.canReschedule ? (
          <Button type="button" variant="outline" onClick={onManage}>
            {t('confirmation.manage')}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onBookAnother}>
          {t('confirmation.bookAnother')}
        </Button>
      </div>
    </div>
  );
}
