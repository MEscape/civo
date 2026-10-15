'use client';

import { useId, useState } from 'react';

import { CheckboxField } from '@components/shared/checkbox-field';
import { ComboboxField } from '@components/shared/combobox-field';
import { TextField } from '@components/shared/text-field';

import { useTranslations } from '@i18n/client';

import { RESOURCE_TYPES } from '../../../application/contracts/booking-constraints';
import { deleteResourceAction } from '../../actions/delete-resource-action';
import { saveResourceAction } from '../../actions/save-resource-action';
import { isEmptyPlan } from '../../drafts/availability-plan-form';
import { withResourcePreset } from '../../drafts/preset-drafts';
import { ANY_LOCATION, resourceDraftOf, toResourceInput } from '../../drafts/resource-draft';
import { skillChoices, toSkillKey } from '../../drafts/skill-key';
import { useDraftGuard } from '../../hooks/use-draft-guard';
import { useErrorText } from '../../hooks/use-error-text';
import { useSaveForm } from '../../hooks/use-save-form';
import { RESOURCE_TYPE_MESSAGE_KEYS } from '../../messages/message-keys';
import { resourceConfigSchema } from '../../schemas/resource-config-schema';
import { DeleteEntityButton } from '../shared/delete-entity-button';
import { FormActions } from '../shared/form-actions';
import { FormErrorSummary } from '../shared/form-error-summary';
import { NumberField } from '../shared/number-field';
import { OptionSelectField } from '../shared/option-select-field';

import { OwnHoursSection } from './own-hours-section';

import type { ResourceDraft } from '../../drafts/resource-draft';
import type { LocationOption, ResourceDto } from '../../dto/setup-dto';
import type { AvailabilityPlanForm } from '../../schemas/availability-plan-schema';

export interface ResourceFormProps {
  readonly websiteId: string;
  /** The place the resource is being made or changed at. */
  readonly location: LocationOption;
  /** The week this place is open: the resource's own hours can only be narrower. */
  readonly locationHours: AvailabilityPlanForm['weekly'];
  /** The capabilities other resources already have, offered so a value is picked, not retyped. */
  readonly skillOptions: readonly string[];
  readonly resource?: ResourceDto | undefined;
  /** The template a new resource starts from. */
  readonly presetKey?: string | undefined;
  readonly onSaved: (resource: ResourceDto) => void;
  readonly onCancel: () => void;
}

const SHOWN_AT_FIELD = ['name', 'type', 'capacity', 'skills', 'locationId'] as const;

export function ResourceForm({
  websiteId,
  location,
  locationHours,
  skillOptions,
  resource,
  presetKey,
  onSaved,
  onCancel,
}: ResourceFormProps) {
  const t = useTranslations('booking');
  const id = useId();
  const [draft, setDraft] = useState(() =>
    withResourcePreset(
      resourceDraftOf(resource, location.id),
      presetKey,
      presetKey === undefined ? '' : t(`presets.resources.${presetKey}` as never),
    ),
  );
  useDraftGuard(draft);
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
          // An employee makes their own calendar; what is set up from here is the rest.
          options={RESOURCE_TYPES.filter((kind) => kind !== 'employee').map((kind) => ({
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
            { value: location.id, label: t('resources.onlyHere', { name: location.name }) },
            { value: ANY_LOCATION, label: t('resources.anyLocation') },
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
          <ComboboxField
            selectionMode="multiple"
            id={`${id}-skills`}
            label={t('resources.skills')}
            hint={t('resources.skillsHint')}
            error={errorText('skills')}
            options={skillChoices(skillOptions, draft.skills)}
            values={draft.skills}
            emptyText={t('form.noMatches')}
            createText={(value) => t('form.addValue', { value })}
            removeText={(label) => t('form.removeValue', { label })}
            normalizeCreated={toSkillKey}
            onValuesChange={(skills) => {
              update({ skills });
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
          bounds={locationHours}
          disabled={form.isPending}
          errors={form.errors}
          onEnabledChange={(hasOwnHours) => {
            // Narrowing starts from the whole of the location's week, not from nothing.
            update({
              hasOwnHours,
              availability:
                hasOwnHours && isEmptyPlan(draft.availability)
                  ? { weekly: locationHours, exceptions: [] }
                  : draft.availability,
            });
          }}
          onPlanChange={(availability) => {
            update({ availability });
          }}
        />
      </section>

      <FormActions
        isPending={form.isPending}
        onCancel={onCancel}
        removal={
          resource === undefined ? undefined : (
            <DeleteEntityButton
              kind="resource"
              name={resource.name}
              onDelete={() => deleteResourceAction({ websiteId, id: resource.id })}
              onDeleted={onCancel}
            />
          )
        }
      />
    </form>
  );
}
