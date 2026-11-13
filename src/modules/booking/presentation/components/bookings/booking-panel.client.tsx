'use client';

import { InfoDialog } from '@components/shared/dialog';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { customerNameOf } from '../../forms/booking-names';
import { useBookingPanelFacts } from '../../hooks/use-booking-panel-facts';
import { BookingStatusChip } from '../shared/booking-status-chip';
import { DetailFact } from '../shared/detail-fact';

import { LifecycleActions } from './lifecycle-actions.client';
import { StaffActions } from './staff-actions.client';

import type { BookingDetailDto, BookingNamesDto } from '../../dto/booking-dto';

export interface BookingPanelProps {
  readonly booking: BookingDetailDto;
  readonly names: BookingNamesDto;
  /** Whether to offer the actions: display only, every use case authorizes on its own. */
  readonly mayManage: boolean;
  /** The list without this booking chosen. */
  readonly closeHref: string;
}

/**
 * What one booking of the list opens (mockup 08), as a dialog like every other thing opened from a
 * list: what was booked, when on the location's clock, where, the citizen's contact details, and who
 * serves it with the changes that fit each place. The booking's own actions are one menu at the foot.
 * The table behind keeps its whole width. The address says which booking is open, so closing is going
 * back to the list without it. The citizen's details reach this dialog only because the use case
 * answered someone who may read the website's bookings (BD-26); they are not logged and the page is
 * never cached for anybody else.
 */
export function BookingPanel({ booking, names, mayManage, closeHref }: BookingPanelProps) {
  const t = useTranslations('booking');
  const router = useRouter();
  const { book, service, subtitle, employees, resources } = useBookingPanelFacts(booking, names);
  const { customer } = booking;

  return (
    <InfoDialog
      open
      size="lg"
      title={service}
      description={subtitle}
      status={<BookingStatusChip status={booking.status} assignment={booking.assignment} />}
      closeLabel={t('bookings.panel.close')}
      onClose={() => {
        router.push(closeHref);
      }}
      actions={mayManage ? <LifecycleActions booking={booking} /> : undefined}
    >
      <div className="space-y-5">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <DetailFact label={t('bookings.panel.reference')}>{booking.reference}</DetailFact>
          <DetailFact label={t('bookings.panel.customer')}>
            {customerNameOf(customer) ?? '–'}
          </DetailFact>
          {customer?.email !== undefined && (
            <DetailFact label={t('bookings.panel.email')}>{customer.email}</DetailFact>
          )}
          {customer?.phone !== undefined && (
            <DetailFact label={t('bookings.panel.phone')}>{customer.phone}</DetailFact>
          )}
          {resources.length > 0 && (
            <DetailFact label={t('bookings.panel.resources')}>
              {resources.map((unit) => unit.name).join(', ')}
            </DetailFact>
          )}
          {customer?.notes !== undefined && (
            <div className="sm:col-span-2">
              <DetailFact label={t('bookings.panel.notes')}>{customer.notes}</DetailFact>
            </div>
          )}
        </dl>
        {employees.length > 0 && (
          <section aria-label={t('bookings.panel.staff')} className="space-y-2">
            <h3 className="text-xs font-medium text-copy-muted">{t('bookings.panel.staff')}</h3>
            <StaffActions
              bookingId={booking.id}
              units={employees}
              changes={booking.staffChanges}
              mayChange={mayManage && booking.status === 'confirmed'}
              subtitle={`${service} · ${subtitle}`}
              nameOf={book.resource}
              timeZone={booking.timeZone}
            />
          </section>
        )}
      </div>
    </InfoDialog>
  );
}
