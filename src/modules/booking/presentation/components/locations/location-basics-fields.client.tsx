'use client';

import { useId, useMemo } from 'react';

import { Controller, useWatch } from 'react-hook-form';

import { TextField } from '@components/shared/field';
import type { PointMapTiles } from '@components/shared/point-map';
import { AutocompleteField } from '@components/shared/select-field';

import { useAddressSearch } from '@hooks/use-address-search';

import { useLocale, useTranslations } from '@i18n/client';

import { isBlank } from '@lib/utils';

import { timeZoneOptions } from '../../forms/time-zone-options';
import { createZonedFormat, MISSING_VALUE } from '../../hooks/use-zoned-format';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';
import { FormSection } from '../shared/form-section';
import { SwitchField } from '../shared/switch-field.client';

import { LocationPlaceMap } from './location-place-map.client';

import type { LocationFormValues } from '../../schemas/location-schema';
import type { UseFormReturn } from 'react-hook-form';

export interface LocationBasicsFieldsProps {
  readonly form: UseFormReturn<LocationFormValues>;
  readonly timeZones: readonly string[];
  /** The zone cannot change: the location has confirmed bookings ahead. */
  readonly isZoneLocked: boolean;
  /** The map provider's settings; without them the form has no map and no address suggestions. */
  readonly tiles: PointMapTiles | null;
}

/**
 * What a location is: its name, address and zone, and whether it is switched on. The address is
 * suggested while it is typed and pinned on a map beside the fields, so a typo shows before saving;
 * the zone is suggested with its offset. Anything typed is kept, so nothing depends on the lists.
 */
export function LocationBasicsFields({
  form,
  timeZones,
  isZoneLocked,
  tiles,
}: LocationBasicsFieldsProps) {
  const t = useTranslations('booking');
  const app = useTranslations('app');
  const locale = useLocale();
  const id = useId();
  const { errors } = form.formState;
  const [name, address, timeZone] = useWatch({
    control: form.control,
    name: ['name', 'address', 'timeZone'],
  });
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  const { hits, isSearching } = useAddressSearch({
    query: address,
    accessToken: tiles?.accessToken ?? null,
    language: locale,
    isEnabled: true,
  });
  const place = isBlank(address) ? null : (hits[0] ?? null);
  const zoneOptions = useMemo(() => {
    const zoned = createZonedFormat(locale);
    const now = new Date().toISOString();
    return timeZoneOptions(timeZone, timeZones, (zone) => {
      const short = zoned.zoneName(now, zone);
      return short === MISSING_VALUE ? undefined : short;
    });
  }, [timeZone, timeZones, locale]);

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <TextField
            id={`${id}-name`}
            label={t('form.basics.name')}
            hint={t('form.basics.nameHint')}
            autoComplete="organization"
            error={errorText(errors.name?.message)}
            {...form.register('name')}
          />
          <Controller
            control={form.control}
            name="address"
            render={({ field }) => (
              <AutocompleteField
                id={`${id}-address`}
                label={t('form.basics.address')}
                hint={t('form.basics.addressHint')}
                error={errorText(errors.address?.message)}
                value={field.value}
                onValueChange={field.onChange}
                options={hits.map((hit) => ({ value: hit.label }))}
                isSearching={isSearching}
                searchingLabel={app('autocomplete.searching')}
                autoComplete="street-address"
              />
            )}
          />
          <Controller
            control={form.control}
            name="timeZone"
            render={({ field }) => (
              <AutocompleteField
                id={`${id}-zone`}
                label={t('form.basics.timeZone')}
                hint={
                  isZoneLocked ? t('form.basics.timeZoneLocked') : t('form.basics.timeZoneHint')
                }
                error={errorText(errors.timeZone?.message)}
                value={field.value}
                onValueChange={field.onChange}
                options={zoneOptions}
                searchingLabel={app('autocomplete.searching')}
                disabled={isZoneLocked}
              />
            )}
          />
        </div>
        {tiles !== null && (
          // The map takes the height of the three fields beside it.
          <div className="flex flex-col">
            <LocationPlaceMap
              className="h-auto min-h-64 flex-1"
              tiles={tiles}
              place={place}
              name={name === '' ? t('form.basics.name') : name}
              label={t('form.basics.mapLabel')}
              emptyLabel={t('form.basics.mapEmpty')}
            />
          </div>
        )}
      </div>
      <FormSection title={t('form.basics.sectionStatus')}>
        <div className="rounded-token border border-border bg-surface p-4 md:max-w-[calc(50%-1rem)]">
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <SwitchField
                id={`${id}-active`}
                label={t('form.basics.active')}
                hint={t('form.basics.activeHint')}
                checked={field.value}
                onCheckedChange={field.onChange}
                offNote={t('form.basics.inactiveNote')}
              />
            )}
          />
        </div>
      </FormSection>
    </div>
  );
}
