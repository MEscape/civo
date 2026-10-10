'use client';

import { useId, useState } from 'react';

import { CheckboxField } from '@components/shared/checkbox-field';
import { TextField } from '@components/shared/text-field';

import { useTranslations } from '@i18n/client';

import { trimToNull } from '@lib/utils';

import { saveLocationAction } from '../../actions/save-location-action';
import { planFormOf } from '../../drafts/availability-plan-form';
import { useErrorText } from '../../hooks/use-error-text';
import { useSaveForm } from '../../hooks/use-save-form';
import { locationConfigSchema } from '../../schemas/location-config-schema';
import { AvailabilityEditor } from '../availability/availability-editor';
import { FormActions } from '../shared/form-actions';
import { FormErrorSummary } from '../shared/form-error-summary';

import type { LocationDto } from '../../dto/setup-dto';

export interface LocationFormProps {
  readonly websiteId: string;
  readonly location?: LocationDto | undefined;
  readonly onSaved: (location: LocationDto) => void;
  readonly onCancel: () => void;
}

const DEFAULT_ZONE = 'Europe/Berlin';
const SHOWN_AT_FIELD = ['name', 'address', 'timeZone'] as const;

/** The zones the browser knows, offered as suggestions while typing; the server accepts only valid ones. */
function knownTimeZones(): readonly string[] {
  return typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : [DEFAULT_ZONE];
}

function browserZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_ZONE;
}

export function LocationForm({ websiteId, location, onSaved, onCancel }: LocationFormProps) {
  const t = useTranslations('booking');
  const id = useId();
  const [name, setName] = useState(location?.name ?? '');
  const [address, setAddress] = useState(location?.address ?? '');
  const [timeZone, setTimeZone] = useState(location?.timeZone ?? browserZone());
  const [isActive, setIsActive] = useState(location?.isActive ?? true);
  const [openingHours, setOpeningHours] = useState(planFormOf(location?.openingHours));

  const form = useSaveForm({ schema: locationConfigSchema, save: saveLocationAction, onSaved });
  const errorText = useErrorText(form.errors);

  return (
    <form
      noValidate
      aria-busy={form.isPending}
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        form.submit({
          websiteId,
          ...(location === undefined ? {} : { id: location.id }),
          name: name.trim(),
          address: trimToNull(address),
          timeZone: timeZone.trim(),
          openingHours,
          isActive,
        });
      }}
    >
      <h3 className="text-base font-medium text-copy">
        {location === undefined ? t('locations.new') : t('locations.edit')}
      </h3>
      <FormErrorSummary errors={form.errors} shownAtField={SHOWN_AT_FIELD} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id={`${id}-name`}
          label={t('locations.name')}
          value={name}
          error={errorText('name')}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <TextField
          id={`${id}-address`}
          label={t('locations.address')}
          hint={t('locations.addressHint')}
          value={address}
          error={errorText('address')}
          onChange={(event) => {
            setAddress(event.target.value);
          }}
        />
        <div>
          <TextField
            id={`${id}-zone`}
            label={t('locations.timeZone')}
            hint={t('locations.timeZoneHint')}
            value={timeZone}
            list={`${id}-zones`}
            autoComplete="off"
            error={errorText('timeZone')}
            onChange={(event) => {
              setTimeZone(event.target.value);
            }}
          />
          <datalist id={`${id}-zones`}>
            {knownTimeZones().map((zone) => (
              // eslint-disable-next-line jsx-a11y/control-has-associated-label -- a datalist option carries its text in `value`
              <option key={zone} value={zone} />
            ))}
          </datalist>
        </div>
        <CheckboxField
          id={`${id}-active`}
          label={t('locations.active')}
          hint={t('locations.activeHint')}
          checked={isActive}
          onChange={(event) => {
            setIsActive(event.target.checked);
          }}
        />
      </div>

      <section className="space-y-3">
        <h4 className="text-sm font-medium text-copy">{t('locations.openingHours')}</h4>
        <p className="text-xs text-copy-muted">{t('locations.openingHoursHint')}</p>
        <AvailabilityEditor
          value={openingHours}
          onChange={setOpeningHours}
          disabled={form.isPending}
        />
      </section>

      <FormActions isPending={form.isPending} onCancel={onCancel} />
    </form>
  );
}
