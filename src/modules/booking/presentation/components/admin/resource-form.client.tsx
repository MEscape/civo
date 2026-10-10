'use client';

import { useId, useState } from 'react';

import { CheckboxField } from '@components/shared/checkbox-field';
import { TextField } from '@components/shared/text-field';

import { useTranslations } from '@i18n/client';

import { RESOURCE_TYPES } from '../../../application/contracts/booking-constraints';
import { saveResourceAction } from '../../actions/save-resource-action';
import { ANY_LOCATION, resourceDraftOf, toResourceInput } from '../../drafts/resource-draft';
import { useErrorText } from '../../hooks/use-error-text';
import { useSaveForm } from '../../hooks/use-save-form';
import { RESOURCE_TYPE_MESSAGE_KEYS } from '../../messages/message-keys';
import { resourceConfigSchema } from '../../schemas/resource-config-schema';
import { FormActions } from '../shared/form-actions';
import { FormErrorSummary } from '../shared/form-error-summary';
import { NumberField } from '../shared/number-field';
import { OptionSelectField } from '../shared/option-select-field';

import { OwnHoursSection } from './own-hours-section';

import type { ResourceDraft } from '../../drafts/resource-draft';
import type { LocationDto, ResourceDto } from '../../dto/setup-dto';

export interface ResourceFormProps {
  readonly websiteId: string;
  readonly locations: readonly LocationDto[];
  readonly resource?: ResourceDto | undefined;
  readonly onSaved: (resource: ResourceDto) => void;
  readonly onCancel: () => void;
}

const SHOWN_AT_FIELD = ['name', 'type', 'capacity', 'skills', 'locationId'] as const;

export function ResourceForm({
  websiteId,
  locations,
  resource,
  onSaved,
  onCancel,
}: ResourceFormProps) {
  const t = useTranslations('booking');
  const id = useId();
  const [draft, setDraft] = useState(() => resourceDraftOf(resource));
  const form = useSaveForm({ schema: resourceConfigSchema, save: saveResourceAction, onSaved });
  const errorText = useErrorText(form.errors);

  function update(patch: Partial<ResourceDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  return (
    <form
      noValidate
      aria-busy={form.isPending}
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        form.submit(toResourceInput(websiteId, resource?.id, draft));
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
          value={draft.name}
          error={errorText('name')}
          onChange={(event) => {
            update({ name: event.target.value });
          }}
        />
        <OptionSelectField
          id={`${id}-type`}
          label={t('resources.type')}
          value={draft.type}
          error={errorText('type')}
          options={RESOURCE_TYPES.map((kind) => ({
            value: kind,
            label: t(RESOURCE_TYPE_MESSAGE_KEYS[kind]),
          }))}
          onValueChange={(type) => {
            update({ type });
          }}
        />
        <OptionSelectField
          id={`${id}-location`}
          label={t('resources.location')}
          hint={t('resources.locationHint')}
          value={draft.locationId}
          error={errorText('locationId')}
          options={[
            { value: ANY_LOCATION, label: t('resources.anyLocation') },
            ...locations.map((location) => ({ value: location.id, label: location.name })),
          ]}
          onValueChange={(locationId) => {
            update({ locationId });
          }}
        />
        <NumberField
          id={`${id}-capacity`}
          label={t('resources.capacity')}
          hint={t('resources.capacityHint')}
          value={draft.capacity}
          min={1}
          allowEmpty
          error={errorText('capacity')}
          onChange={(capacity) => {
            update({ capacity });
          }}
        />
        <div className="sm:col-span-2">
          <TextField
            id={`${id}-skills`}
            label={t('resources.skills')}
            hint={t('resources.skillsHint')}
            value={draft.skills}
            error={errorText('skills')}
            onChange={(event) => {
              update({ skills: event.target.value });
            }}
          />
        </div>
        <CheckboxField
          id={`${id}-active`}
          label={t('resources.active')}
          checked={draft.isActive}
          onChange={(event) => {
            update({ isActive: event.target.checked });
          }}
        />
      </div>

      <section className="space-y-3">
        <OwnHoursSection
          id={`${id}-own-hours`}
          label={t('resources.ownHours')}
          hint={t('resources.ownHoursHint')}
          isEnabled={draft.hasOwnHours}
          plan={draft.availability}
          disabled={form.isPending}
          onEnabledChange={(hasOwnHours) => {
            update({ hasOwnHours });
          }}
          onPlanChange={(availability) => {
            update({ availability });
          }}
        />
      </section>

      <FormActions isPending={form.isPending} onCancel={onCancel} />
    </form>
  );
}
