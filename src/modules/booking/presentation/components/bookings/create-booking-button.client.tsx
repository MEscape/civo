'use client';

import { useId } from 'react';

import { ConfirmDialog } from '@components/shared/dialog';
import { TextField } from '@components/shared/field';
import { SelectField } from '@components/shared/select-field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useCreateBooking } from '../../hooks/use-create-booking';

import { SlotPicker } from './slot-picker.client';

import type { BookingNamesDto } from '../../dto/booking-dto';
import type { WalkInCustomer } from '../../hooks/use-create-booking';

export interface CreateBookingButtonProps {
  readonly names: BookingNamesDto;
  /** The list the new booking is shown in. */
  readonly listHref: string;
}

const CUSTOMER_FIELDS = [
  { key: 'firstName', type: 'text', autoComplete: 'off' },
  { key: 'lastName', type: 'text', autoComplete: 'off' },
  { key: 'email', type: 'email', autoComplete: 'off' },
  { key: 'phone', type: 'tel', autoComplete: 'off' },
] as const satisfies ReadonlyArray<{
  readonly key: keyof WalkInCustomer;
  readonly type: string;
  readonly autoComplete: string;
}>;

/** "Buchung anlegen" (mockups 07, 08): a manager books a free time for someone who calls or walks in. */
export function CreateBookingButton({ names, listHref }: CreateBookingButtonProps) {
  const t = useTranslations('booking');
  const id = useId();
  const form = useCreateBooking({ today: names.locations[0]?.today ?? '', listHref });
  const options = (rows: ReadonlyArray<{ readonly id: string; readonly name: string }>) =>
    rows.map((row) => ({ value: row.id, label: row.name }));

  return (
    <>
      <Button type="button" onClick={form.open}>
        {t('bookings.actions.create')}
      </Button>
      <ConfirmDialog
        open={form.isOpen}
        size="lg"
        confirmVariant="default"
        title={t('bookings.create.title')}
        description={t('bookings.create.description')}
        confirmLabel={t('bookings.create.confirm')}
        cancelLabel={t('bookings.create.cancel')}
        isConfirmDisabled={form.picker.start === null}
        isPending={form.command.isPending}
        onCancel={form.close}
        onConfirm={form.create}
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              id={`${id}-service`}
              label={t('bookings.create.service')}
              placeholder={t('bookings.create.choose')}
              value={form.place.serviceId}
              onValueChange={(serviceId) => {
                form.choose({ serviceId });
              }}
              options={options(names.services)}
            />
            <SelectField
              id={`${id}-location`}
              label={t('bookings.create.location')}
              placeholder={t('bookings.create.choose')}
              value={form.place.locationId}
              onValueChange={(locationId) => {
                form.choose({ locationId });
              }}
              options={options(names.locations)}
            />
          </div>
          <SlotPicker picker={form.picker} source={form.place} />
          <div className="grid gap-3 sm:grid-cols-2">
            {CUSTOMER_FIELDS.map(({ key, type, autoComplete }) => (
              <TextField
                key={key}
                id={`${id}-${key}`}
                label={t(`bookings.create.${key}`)}
                type={type}
                autoComplete={autoComplete}
                value={form.customer[key]}
                onChange={(event) => {
                  form.setCustomer({ [key]: event.target.value });
                }}
              />
            ))}
          </div>
          <p role="status" className="text-sm text-copy-muted">
            {form.command.message}
          </p>
        </div>
      </ConfirmDialog>
    </>
  );
}
