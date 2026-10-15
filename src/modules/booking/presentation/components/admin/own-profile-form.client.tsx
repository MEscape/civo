'use client';

import { useId, useState } from 'react';

import { ComboboxField } from '@components/shared/combobox-field';
import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { saveOwnProfileAction } from '../../actions/save-own-profile-action';
import { EMPTY_PLAN, planFormOf, withPreset } from '../../drafts/availability-plan-form';
import { clipWeek } from '../../drafts/hours-conflicts';
import { useDraftGuard } from '../../hooks/use-draft-guard';
import { useErrorText } from '../../hooks/use-error-text';
import { useSaveForm } from '../../hooks/use-save-form';
import { ownProfileSchema } from '../../schemas/own-profile-schema';
import { AvailabilityEditor } from '../availability/availability-editor';
import { FormErrorSummary } from '../shared/form-error-summary';
import { OptionSelectField } from '../shared/option-select-field';

import type { OwnProfileDto } from '../../dto/setup-dto';

export interface OwnProfileFormProps {
  readonly websiteId: string;
  readonly own: OwnProfileDto;
}

const SHOWN_AT_FIELD = ['name', 'locationId', 'offeredServiceIds', 'availability'] as const;

/** Where a new employee starts: the only location there is, otherwise they choose. */
function startLocationOf(own: OwnProfileDto): string {
  return (
    own.profile?.locationId ?? (own.locations.length === 1 ? (own.locations[0]?.id ?? '') : '')
  );
}

/**
 * An employee's own place in the booking system. Nobody else sets it up: it
 * is the calendar visitors are booked into, with the one location the
 * employee works at, the services they offer there and the hours they work,
 * which stay inside the location's. The services on offer are those of the
 * chosen location, so choosing another location changes the list, and what
 * was offered but is not offered there is taken off, saying so.
 */
export function OwnProfileForm({ websiteId, own }: OwnProfileFormProps) {
  const t = useTranslations('booking');
  const id = useId();
  const saved = own.profile;
  const [name, setName] = useState(saved?.name ?? '');
  const [locationId, setLocationId] = useState(() => startLocationOf(own));
  const [offered, setOffered] = useState<readonly string[]>(own.offeredServiceIds);
  const [dropped, setDropped] = useState(0);
  // A first-time employee starts from an ordinary office week instead of a closed one.
  const [plan, setPlan] = useState(() =>
    saved?.availability === null || saved === null
      ? withPreset(EMPTY_PLAN, 'office')
      : planFormOf(saved.availability),
  );
  const [justSaved, setJustSaved] = useState(false);
  const guard = useDraftGuard({ name, locationId, offered: [...offered].sort(), plan });
  const form = useSaveForm({
    schema: ownProfileSchema,
    save: saveOwnProfileAction,
    onSaved: () => {
      guard.markSaved();
      setJustSaved(true);
    },
  });
  const errorText = useErrorText(form.errors);

  const location = own.locations.find((candidate) => candidate.id === locationId);
  const available = own.services.filter((service) => service.locationIds.includes(locationId));
  const bounds = location === undefined ? null : planFormOf(location.employeeHours).weekly;

  function chooseLocation(next: string) {
    const stillOffered = offered.filter((serviceId) =>
      own.services.some(
        (service) => service.id === serviceId && service.locationIds.includes(next),
      ),
    );
    const frame = own.locations.find((candidate) => candidate.id === next)?.employeeHours;
    setDropped(offered.length - stillOffered.length);
    setOffered(stillOffered);
    setLocationId(next);
    // The week stays inside the hours of the place it is worked at.
    if (frame !== undefined) {
      setPlan((current) => ({
        ...current,
        weekly: clipWeek(current.weekly, planFormOf(frame).weekly),
      }));
    }
    setJustSaved(false);
  }

  return (
    <form
      noValidate
      aria-busy={form.isPending}
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        form.submit({
          websiteId,
          name: name.trim(),
          locationId,
          offeredServiceIds: offered,
          availability: plan,
        });
      }}
    >
      <FormErrorSummary errors={form.errors} shownAtField={SHOWN_AT_FIELD} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id={`${id}-name`}
          label={t('own.name')}
          hint={t('own.nameHint')}
          value={name}
          error={errorText('name')}
          onChange={(event) => {
            setJustSaved(false);
            setName(event.target.value);
          }}
        />
        <OptionSelectField
          id={`${id}-location`}
          label={t('own.location')}
          hint={t('own.locationHint')}
          value={locationId}
          error={errorText('locationId')}
          options={own.locations.map((candidate) => ({
            value: candidate.id,
            label: candidate.name,
          }))}
          onValueChange={chooseLocation}
        />
      </div>

      <div className="space-y-2">
        {available.length === 0 ? (
          <>
            <p className="text-sm font-medium text-copy">{t('own.services')}</p>
            <p className="text-sm text-copy-muted">
              {locationId === '' ? t('own.chooseLocationFirst') : t('own.noServices')}
            </p>
          </>
        ) : (
          <ComboboxField
            selectionMode="multiple"
            id={`${id}-services`}
            label={t('own.services')}
            hint={t('own.servicesHint')}
            placeholder={t('own.servicesPlaceholder')}
            error={errorText('offeredServiceIds')}
            options={available.map((service) => ({ value: service.id, label: service.name }))}
            values={offered}
            emptyText={t('form.noMatches')}
            removeText={(label) => t('form.removeValue', { label })}
            onValuesChange={(next) => {
              setJustSaved(false);
              setDropped(0);
              setOffered(next);
            }}
          />
        )}
        {dropped > 0 && (
          <p role="status" className="text-sm text-warning">
            {t('own.servicesDropped', { count: dropped })}
          </p>
        )}
      </div>

      <section className="space-y-3">
        <h3 className="text-base font-medium text-copy">{t('own.hoursTitle')}</h3>
        <p className="text-xs text-copy-muted">{t('own.hoursHint')}</p>
        {bounds === null ? (
          <p className="text-sm text-copy-muted">{t('own.hoursChooseLocationFirst')}</p>
        ) : (
          <AvailabilityEditor
            value={plan}
            bounds={bounds}
            onChange={(next) => {
              setJustSaved(false);
              setPlan(next);
            }}
            errors={form.errors}
            disabled={form.isPending}
          />
        )}
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={form.isPending || locationId === ''}>
          {form.isPending ? t('form.saving') : t('own.save')}
        </Button>
        {justSaved && (
          <p role="status" className="text-sm text-success">
            {t('own.saved')}
          </p>
        )}
      </div>
    </form>
  );
}
