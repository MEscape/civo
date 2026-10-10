'use client';

import { useId, useState } from 'react';

import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { RESOURCE_TYPES } from '../../../application/contracts/booking-constraints';
import { saveResourceAction } from '../../actions/save-resource-action';
import { useSaveForm } from '../../hooks/use-save-form';
import {
  MESSAGE_PARAMS,
  RESOURCE_TYPE_MESSAGE_KEYS,
  messageKeyForCode,
} from '../../messages/message-keys';
import { resourceConfigSchema } from '../../schemas/resource-config-schema';
import { CheckboxField } from '../shared/checkbox-field';
import { firstCode, FormErrorSummary } from '../shared/form-error-summary';
import { NumberField } from '../shared/number-field';
import { SelectField } from '../shared/select-field';

import { AvailabilityEditor, EMPTY_PLAN } from './availability-editor';

import type { LocationDto, ResourceDto } from '../../dto/setup-dto';
import type { AvailabilityPlanForm } from '../../schemas/availability-plan-schema';

export interface ResourceFormProps {
  readonly websiteId: string;
  readonly locations: readonly LocationDto[];
  readonly resource?: ResourceDto | undefined;
  readonly onSaved: (resource: ResourceDto) => void;
  readonly onCancel: () => void;
}

const SHOWN_AT_FIELD = ['name', 'type', 'capacity', 'skills', 'locationId'] as const;
/** The value of "available at every location"; a real id is never this word. */
const ANY_LOCATION = 'any';

function parseSkills(text: string): string[] {
  return text
    .split(',')
    .map((skill) => skill.trim().toLowerCase())
    .filter((skill) => skill !== '');
}

export function ResourceForm({
  websiteId,
  locations,
  resource,
  onSaved,
  onCancel,
}: ResourceFormProps) {
  const t = useTranslations('booking');
  const id = useId();
  const [name, setName] = useState(resource?.name ?? '');
  const [type, setType] = useState(resource?.type ?? RESOURCE_TYPES[0]);
  const [locationId, setLocationId] = useState(resource?.locationId ?? ANY_LOCATION);
  const [capacity, setCapacity] = useState<number | null>(resource?.capacity ?? null);
  const [skills, setSkills] = useState((resource?.skills ?? []).join(', '));
  const [isActive, setIsActive] = useState(resource?.isActive ?? true);
  const [ownHours, setOwnHours] = useState(
    resource?.availability !== undefined && resource.availability !== null,
  );
  const [availability, setAvailability] = useState<AvailabilityPlanForm>(
    resource?.availability === undefined || resource.availability === null
      ? EMPTY_PLAN
      : (resource.availability as AvailabilityPlanForm),
  );

  const form = useSaveForm({ schema: resourceConfigSchema, save: saveResourceAction, onSaved });
  const errorText = (field: string) => {
    const code = firstCode(form.errors, field);
    return code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);
  };

  return (
    <form
      noValidate
      aria-busy={form.isPending}
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        form.submit({
          websiteId,
          ...(resource === undefined ? {} : { id: resource.id }),
          locationId: locationId === ANY_LOCATION ? null : locationId,
          name: name.trim(),
          type,
          skills: parseSkills(skills),
          capacity,
          availability: ownHours ? availability : null,
          isActive,
        });
      }}
    >
      <h3 className="text-base font-medium text-copy">
        {resource === undefined ? t('resources.new') : t('resources.edit')}
      </h3>
      <FormErrorSummary errors={form.errors} shownAtField={SHOWN_AT_FIELD} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id={`${id}-name`}
          label={t('resources.name')}
          value={name}
          error={errorText('name')}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <SelectField
          id={`${id}-type`}
          label={t('resources.type')}
          value={type}
          error={errorText('type')}
          options={RESOURCE_TYPES.map((kind) => ({
            value: kind,
            label: t(RESOURCE_TYPE_MESSAGE_KEYS[kind]),
          }))}
          onValueChange={setType}
        />
        <SelectField
          id={`${id}-location`}
          label={t('resources.location')}
          hint={t('resources.locationHint')}
          value={locationId}
          error={errorText('locationId')}
          options={[
            { value: ANY_LOCATION, label: t('resources.anyLocation') },
            ...locations.map((location) => ({ value: location.id, label: location.name })),
          ]}
          onValueChange={setLocationId}
        />
        <NumberField
          id={`${id}-capacity`}
          label={t('resources.capacity')}
          hint={t('resources.capacityHint')}
          value={capacity}
          min={1}
          allowEmpty
          error={errorText('capacity')}
          onChange={setCapacity}
        />
        <div className="sm:col-span-2">
          <TextField
            id={`${id}-skills`}
            label={t('resources.skills')}
            hint={t('resources.skillsHint')}
            value={skills}
            error={errorText('skills')}
            onChange={(event) => {
              setSkills(event.target.value);
            }}
          />
        </div>
        <CheckboxField
          id={`${id}-active`}
          label={t('resources.active')}
          checked={isActive}
          onChange={(event) => {
            setIsActive(event.target.checked);
          }}
        />
      </div>

      <section className="space-y-3">
        <CheckboxField
          id={`${id}-own-hours`}
          label={t('resources.ownHours')}
          hint={t('resources.ownHoursHint')}
          checked={ownHours}
          onChange={(event) => {
            setOwnHours(event.target.checked);
          }}
        />
        {ownHours && (
          <AvailabilityEditor
            value={availability}
            onChange={setAvailability}
            disabled={form.isPending}
          />
        )}
      </section>

      <div className="flex gap-2">
        <Button type="submit" disabled={form.isPending}>
          {form.isPending ? t('form.saving') : t('form.save')}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={form.isPending}>
          {t('form.cancel')}
        </Button>
      </div>
    </form>
  );
}
