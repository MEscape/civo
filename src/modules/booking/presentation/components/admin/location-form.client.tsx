'use client';

import { useId, useState } from 'react';

import { CheckboxField } from '@components/shared/checkbox-field';
import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { trimToNull } from '@lib/utils';

import { saveLocationAction } from '../../actions/save-location-action';
import {
  AVAILABILITY_PRESET_KEYS,
  EMPTY_PLAN,
  planFormOf,
  withPreset,
} from '../../drafts/availability-plan-form';
import { useDraftGuard } from '../../hooks/use-draft-guard';
import { useErrorText } from '../../hooks/use-error-text';
import { useSaveForm } from '../../hooks/use-save-form';
import { locationConfigSchema } from '../../schemas/location-config-schema';
import { FormActions } from '../shared/form-actions';
import { FormErrorSummary } from '../shared/form-error-summary';
import { TimeZoneField } from '../shared/time-zone-field';

import { AddressField } from './address-field.client';

import type { AvailabilityPresetKey } from '../../drafts/availability-plan-form';
import type { LocationDto } from '../../dto/setup-dto';

export interface LocationFormProps {
  readonly websiteId: string;
  /** The location being changed; absent when a new one is made. */
  readonly location?: LocationDto | undefined;
  readonly onSaved: (location: LocationDto) => void;
  readonly onCancel: () => void;
}

const DEFAULT_ZONE = 'Europe/Berlin';
const DEFAULT_TEMPLATE: AvailabilityPresetKey = 'office';
const SHOWN_AT_FIELD = ['name', 'address', 'timeZone'] as const;

/** `null` is "decide later": a new location then starts closed. */
type HoursTemplate = AvailabilityPresetKey | null;

/** The week a new location starts with: the chosen template, or closed all week. */
function startingWeek(template: HoursTemplate) {
  return template === null ? EMPTY_PLAN : withPreset(EMPTY_PLAN, template);
}

function browserZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_ZONE;
}

/**
 * Who and where a location is: its name, address and time zone, and whether it
 * can be booked. A new location also chooses the week it starts with; the hours
 * of an existing one are changed on its own timeline, never here.
 */
export function LocationForm({ websiteId, location, onSaved, onCancel }: LocationFormProps) {
  const t = useTranslations('booking');
  const id = useId();
  const [name, setName] = useState(location?.name ?? '');
  const [address, setAddress] = useState(location?.address ?? '');
  const [timeZone, setTimeZone] = useState(location?.timeZone ?? browserZone());
  const [isActive, setIsActive] = useState(location?.isActive ?? true);
  const [template, setTemplate] = useState<HoursTemplate>(DEFAULT_TEMPLATE);

  useDraftGuard({ name, address, timeZone, isActive, template });
  const form = useSaveForm({ schema: locationConfigSchema, save: saveLocationAction, onSaved });
  const errorText = useErrorText(form.errors);

  const openingHours =
    location === undefined ? startingWeek(template) : planFormOf(location.openingHours);

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
          // Who may work when is set by those who manage the bookings, not on this form.
          staffHours: location?.staffHours ?? null,
          isActive,
        });
      }}
    >
      <FormErrorSummary errors={form.errors} shownAtField={SHOWN_AT_FIELD} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id={`${id}-name`}
          label={t('locations.name')}
          hint={t('locations.nameHint')}
          value={name}
          error={errorText('name')}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <AddressField
          id={`${id}-address`}
          value={address}
          error={errorText('address')}
          onChange={setAddress}
        />
        <TimeZoneField
          id={`${id}-zone`}
          label={t('locations.timeZone')}
          hint={t('locations.timeZoneHint')}
          value={timeZone}
          error={errorText('timeZone')}
          onValueChange={setTimeZone}
        />
      </div>

      <div className="rounded-token border border-border bg-canvas p-3">
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

      {location === undefined && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-copy">{t('locations.startWith')}</legend>
          <p className="text-xs text-copy-muted">{t('locations.startWithHint')}</p>
          <div className="flex flex-wrap gap-2">
            {[...AVAILABILITY_PRESET_KEYS, null].map((key) => (
              <Button
                key={key ?? 'later'}
                type="button"
                size="sm"
                variant={template === key ? 'default' : 'outline'}
                aria-pressed={template === key}
                onClick={() => {
                  setTemplate(key);
                }}
              >
                {key === null ? t('locations.startLater') : t(`availability.presets.${key}`)}
              </Button>
            ))}
          </div>
        </fieldset>
      )}

      <FormActions isPending={form.isPending} onCancel={onCancel} />
    </form>
  );
}
