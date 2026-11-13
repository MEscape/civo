'use client';

import { useId } from 'react';

import { SelectField } from '@components/shared/select-field';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { useBookingWebsite } from '../../hooks/use-booking-website';
import { useZonedFormat } from '../../hooks/use-zoned-format';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';
import { bookingRoutes } from '../../routes';
import { DateField } from '../shared/date-field.client';

import type { SlotSource, useStaffSlots } from '../../hooks/use-staff-slots';

export interface SlotPickerProps {
  readonly picker: ReturnType<typeof useStaffSlots>;
  readonly source: SlotSource;
}

/**
 * A day and one of its free times, each time on the location's clock. A day with none says why (the
 * place is closed, the service needs somebody or something that is not there, everything is taken) and,
 * where the cause is a missing calendar, where to set it up.
 */
export function SlotPicker({ picker, source }: SlotPickerProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat();
  const id = useId();
  const { slots } = picker;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DateField
        id={`${id}-day`}
        label={t('bookings.slots.day')}
        value={picker.day}
        onValueChange={(value) => {
          picker.load(value, source);
        }}
      />
      {slots.kind === 'ready' && slots.view.slots.length > 0 ? (
        <SelectField
          id={`${id}-slot`}
          label={t('bookings.slots.slot')}
          placeholder={t('bookings.slots.slotPlaceholder')}
          value={picker.start ?? ''}
          onValueChange={picker.choose}
          options={slots.view.slots.map((slot) => ({
            value: slot.start,
            label: format.timeRange(slot.start, slot.end, slots.view.timeZone),
          }))}
        />
      ) : (
        <SlotsMessage slots={slots} source={source} />
      )}
    </div>
  );
}

interface SlotsMessageProps {
  readonly slots: ReturnType<typeof useStaffSlots>['slots'];
  readonly source: SlotSource;
}

/** What stands where the times would be: that they are being looked for, why there are none, or what went wrong. */
function SlotsMessage({ slots, source }: SlotsMessageProps) {
  const t = useTranslations('booking');
  const websiteId = useBookingWebsite();
  const emptiness = slots.kind === 'ready' ? slots.view.emptiness : undefined;
  const isFailure = slots.kind === 'failed';

  return (
    <div
      className={cn('self-end pb-2 text-sm', isFailure ? 'text-danger' : 'text-copy-muted')}
      role={isFailure ? 'alert' : 'status'}
    >
      {slots.kind === 'loading' && t('bookings.slots.loading')}
      {slots.kind === 'idle' && t('bookings.slots.choose')}
      {slots.kind === 'ready' && t(`bookings.slots.empty.${emptiness ?? 'none'}`)}
      {emptiness === 'no-employee' && 'locationId' in source && (
        <>
          {' '}
          <Link
            href={bookingRoutes.locationTeam(websiteId, source.locationId)}
            className="font-medium text-primary-copy underline underline-offset-2"
          >
            {t('bookings.slots.empty.setUpTeam')}
          </Link>
        </>
      )}
      {slots.kind === 'failed' && t(messageKeyForCode(slots.code), MESSAGE_PARAMS)}
    </div>
  );
}
