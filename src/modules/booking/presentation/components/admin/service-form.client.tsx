'use client';

import { useId, useState } from 'react';

import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';
import { Label, Textarea } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { trimToNull } from '@lib/utils';

import {
  CHANGE_ACTORS,
  INFORMATION_FIELDS,
  RESOURCE_TYPES,
  SERVICE_LIMITS,
} from '../../../application/contracts/booking-constraints';
import { saveServiceAction } from '../../actions/save-service-action';
import { useSaveForm } from '../../hooks/use-save-form';
import {
  CHANGE_ACTOR_MESSAGE_KEYS,
  INFORMATION_FIELD_MESSAGE_KEYS,
  MESSAGE_PARAMS,
  RESOURCE_TYPE_MESSAGE_KEYS,
  messageKeyForCode,
} from '../../messages/message-keys';
import { serviceConfigSchema } from '../../schemas/service-config-schema';
import { CheckboxField } from '../shared/checkbox-field';
import { firstCode, FormErrorSummary } from '../shared/form-error-summary';
import { FormSection } from '../shared/form-section';
import { NumberField } from '../shared/number-field';
import { SelectField } from '../shared/select-field';

import { AvailabilityEditor, EMPTY_PLAN } from './availability-editor';

import type { InformationField } from '../../../application/contracts/booking-constraints';
import type { LocationDto, ResourceDto, ServiceDto } from '../../dto/setup-dto';
import type { AvailabilityPlanForm } from '../../schemas/availability-plan-schema';

export interface ServiceFormProps {
  readonly websiteId: string;
  readonly locations: readonly LocationDto[];
  readonly resources: readonly ResourceDto[];
  readonly service?: ServiceDto | undefined;
  readonly onSaved: (service: ServiceDto) => void;
  readonly onCancel: () => void;
}

interface RequirementDraft {
  readonly resourceType: string;
  readonly skills: string;
  readonly count: number;
  readonly resourceIds: readonly string[];
}

interface PolicyDraft {
  readonly isAllowed: boolean;
  readonly deadlineMinutes: number;
  readonly allowedActors: readonly string[];
}

type InformationDraft = Readonly<
  Record<InformationField, { enabled: boolean; isRequired: boolean }>
>;

const SHOWN_AT_FIELD = [
  'name',
  'description',
  'category',
  'durationMinutes',
  'preparationMinutes',
  'cleanupMinutes',
  'slotIntervalMinutes',
  'noticeMinutes',
  'horizonDays',
  'participantsPerBooking',
  'participantsPerSession',
  'instructions',
] as const;

const DEFAULT_POLICY: PolicyDraft = {
  isAllowed: true,
  deadlineMinutes: 1_440,
  allowedActors: CHANGE_ACTORS,
};
const DEFAULT_REQUIREMENT: RequirementDraft = {
  resourceType: RESOURCE_TYPES[0],
  skills: '',
  count: 1,
  resourceIds: [],
};
const DEFAULT_INFORMATION: InformationDraft = {
  firstName: { enabled: true, isRequired: true },
  lastName: { enabled: true, isRequired: true },
  email: { enabled: true, isRequired: true },
  phone: { enabled: false, isRequired: false },
  referenceNumber: { enabled: false, isRequired: false },
  notes: { enabled: false, isRequired: false },
};
const DEFAULT_DURATION = 30;
const DEFAULT_SLOT_INTERVAL = 15;
const DEFAULT_NOTICE = 60;
const DEFAULT_HORIZON = 60;

function parseList(text: string, separator: RegExp): string[] {
  return text
    .split(separator)
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

function informationOf(service: ServiceDto | undefined): InformationDraft {
  if (service === undefined) {
    return DEFAULT_INFORMATION;
  }
  const draft = Object.fromEntries(
    INFORMATION_FIELDS.map((field) => [field, { enabled: false, isRequired: false }]),
  ) as Record<InformationField, { enabled: boolean; isRequired: boolean }>;
  for (const { field, isRequired } of service.information) {
    draft[field] = { enabled: true, isRequired };
  }
  return draft;
}

export function ServiceForm({
  websiteId,
  locations,
  resources,
  service,
  onSaved,
  onCancel,
}: ServiceFormProps) {
  const t = useTranslations('booking');
  const id = useId();

  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [category, setCategory] = useState(service?.category ?? '');
  const [instructions, setInstructions] = useState(service?.instructions ?? '');
  const [isActive, setIsActive] = useState(service?.isActive ?? true);
  const [duration, setDuration] = useState<number | null>(
    service?.durationMinutes ?? DEFAULT_DURATION,
  );
  const [preparation, setPreparation] = useState<number | null>(service?.preparationMinutes ?? 0);
  const [cleanup, setCleanup] = useState<number | null>(service?.cleanupMinutes ?? 0);
  const [slotInterval, setSlotInterval] = useState<number | null>(
    service?.slotIntervalMinutes ?? DEFAULT_SLOT_INTERVAL,
  );
  const [notice, setNotice] = useState<number | null>(service?.noticeMinutes ?? DEFAULT_NOTICE);
  const [horizon, setHorizon] = useState<number | null>(service?.horizonDays ?? DEFAULT_HORIZON);
  const [locationIds, setLocationIds] = useState<readonly string[]>(
    service?.locationIds ?? locations.slice(0, 1).map((location) => location.id),
  );
  const [requirements, setRequirements] = useState<readonly RequirementDraft[]>(
    service?.requirements.map((requirement) => ({
      resourceType: requirement.resourceType,
      skills: requirement.skills.join(', '),
      count: requirement.count,
      resourceIds: requirement.resourceIds ?? [],
    })) ?? [DEFAULT_REQUIREMENT],
  );
  const [perBooking, setPerBooking] = useState<number | null>(service?.participantsPerBooking ?? 1);
  const [perSession, setPerSession] = useState<number | null>(service?.participantsPerSession ?? 1);
  const [information, setInformation] = useState<InformationDraft>(informationOf(service));
  const [documents, setDocuments] = useState((service?.requiredDocuments ?? []).join('\n'));
  const [cancellation, setCancellation] = useState<PolicyDraft>(
    service?.cancellation ?? DEFAULT_POLICY,
  );
  const [rescheduling, setRescheduling] = useState<PolicyDraft>(
    service?.rescheduling ?? DEFAULT_POLICY,
  );
  const [ownHours, setOwnHours] = useState(
    service?.availability !== undefined && service.availability !== null,
  );
  const [availability, setAvailability] = useState<AvailabilityPlanForm>(
    service?.availability === undefined || service.availability === null
      ? EMPTY_PLAN
      : (service.availability as AvailabilityPlanForm),
  );

  const form = useSaveForm({ schema: serviceConfigSchema, save: saveServiceAction, onSaved });
  const errorText = (field: string) => {
    const code = firstCode(form.errors, field);
    return code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);
  };

  function submit() {
    form.submit({
      websiteId,
      ...(service === undefined ? {} : { id: service.id }),
      name: name.trim(),
      description: trimToNull(description),
      category: trimToNull(category),
      isActive,
      durationMinutes: duration ?? 0,
      preparationMinutes: preparation ?? 0,
      cleanupMinutes: cleanup ?? 0,
      slotIntervalMinutes: slotInterval ?? 0,
      locationIds,
      requirements: requirements.map((requirement) => ({
        resourceType: requirement.resourceType,
        skills: parseList(requirement.skills.toLowerCase(), /,/),
        count: requirement.count,
        resourceIds: requirement.resourceIds.length === 0 ? null : requirement.resourceIds,
      })),
      participantsPerBooking: perBooking ?? 0,
      participantsPerSession: perSession ?? 0,
      noticeMinutes: notice ?? 0,
      horizonDays: horizon ?? 0,
      availability: ownHours ? availability : null,
      cancellation,
      rescheduling,
      information: INFORMATION_FIELDS.flatMap((field) =>
        information[field].enabled ? [{ field, isRequired: information[field].isRequired }] : [],
      ),
      requiredDocuments: parseList(documents, /\r?\n/),
      instructions: trimToNull(instructions),
    });
  }

  return (
    <form
      noValidate
      aria-busy={form.isPending}
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <h3 className="text-base font-medium text-copy">
        {service === undefined ? t('services.new') : t('services.edit')}
      </h3>
      <FormErrorSummary errors={form.errors} shownAtField={SHOWN_AT_FIELD} />

      <FormSection title={t('services.sections.basics')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id={`${id}-name`}
            label={t('services.name')}
            value={name}
            error={errorText('name')}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          <TextField
            id={`${id}-category`}
            label={t('services.category')}
            hint={t('services.categoryHint')}
            value={category}
            error={errorText('category')}
            onChange={(event) => {
              setCategory(event.target.value);
            }}
          />
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`${id}-description`}>{t('services.description')}</Label>
            <Textarea
              id={`${id}-description`}
              value={description}
              maxLength={SERVICE_LIMITS.descriptionMax}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
            />
          </div>
          <CheckboxField
            id={`${id}-active`}
            label={t('services.active')}
            hint={t('services.activeHint')}
            checked={isActive}
            onChange={(event) => {
              setIsActive(event.target.checked);
            }}
          />
        </div>
      </FormSection>

      <FormSection
        title={t('services.sections.timing')}
        description={t('services.sections.timingHint')}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <NumberField
            id={`${id}-duration`}
            label={t('services.duration')}
            value={duration}
            min={SERVICE_LIMITS.durationMin}
            max={SERVICE_LIMITS.durationMax}
            error={errorText('durationMinutes')}
            onChange={setDuration}
          />
          <NumberField
            id={`${id}-preparation`}
            label={t('services.preparation')}
            hint={t('services.preparationHint')}
            value={preparation}
            min={0}
            max={SERVICE_LIMITS.bufferMax}
            error={errorText('preparationMinutes')}
            onChange={setPreparation}
          />
          <NumberField
            id={`${id}-cleanup`}
            label={t('services.cleanup')}
            hint={t('services.cleanupHint')}
            value={cleanup}
            min={0}
            max={SERVICE_LIMITS.bufferMax}
            error={errorText('cleanupMinutes')}
            onChange={setCleanup}
          />
          <NumberField
            id={`${id}-interval`}
            label={t('services.slotInterval')}
            hint={t('services.slotIntervalHint')}
            value={slotInterval}
            min={SERVICE_LIMITS.slotIntervalMin}
            max={SERVICE_LIMITS.slotIntervalMax}
            error={errorText('slotIntervalMinutes')}
            onChange={setSlotInterval}
          />
          <NumberField
            id={`${id}-notice`}
            label={t('services.notice')}
            hint={t('services.noticeHint')}
            value={notice}
            min={0}
            error={errorText('noticeMinutes')}
            onChange={setNotice}
          />
          <NumberField
            id={`${id}-horizon`}
            label={t('services.horizon')}
            hint={t('services.horizonHint')}
            value={horizon}
            min={1}
            max={SERVICE_LIMITS.horizonDaysMax}
            error={errorText('horizonDays')}
            onChange={setHorizon}
          />
        </div>
      </FormSection>

      <FormSection
        title={t('services.sections.locations')}
        description={t('services.sections.locationsHint')}
      >
        {locations.length === 0 && (
          <p className="text-sm text-copy-muted">{t('services.noLocations')}</p>
        )}
        {locations.map((location) => (
          <CheckboxField
            key={location.id}
            id={`${id}-loc-${location.id}`}
            label={location.name}
            checked={locationIds.includes(location.id)}
            onChange={(event) => {
              setLocationIds(
                event.target.checked
                  ? [...locationIds, location.id]
                  : locationIds.filter((value) => value !== location.id),
              );
            }}
          />
        ))}
        {errorText('locationIds') !== undefined && (
          <p role="alert" className="text-xs text-danger">
            {errorText('locationIds')}
          </p>
        )}
      </FormSection>

      <FormSection
        title={t('services.sections.resources')}
        description={t('services.sections.resourcesHint')}
      >
        {requirements.map((requirement, index) => {
          const prefix = `${id}-req-${index}`;
          const update = (patch: Partial<RequirementDraft>) => {
            setRequirements(
              requirements.map((existing, position) =>
                position === index ? { ...existing, ...patch } : existing,
              ),
            );
          };
          const candidates = resources.filter(
            (resource) => resource.type === requirement.resourceType,
          );
          return (
            // eslint-disable-next-line react/no-array-index-key -- rows are edited by position
            <div key={prefix} className="space-y-3 rounded-token border border-border p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SelectField
                  id={`${prefix}-type`}
                  label={t('services.requirementType')}
                  value={requirement.resourceType}
                  options={RESOURCE_TYPES.map((kind) => ({
                    value: kind,
                    label: t(RESOURCE_TYPE_MESSAGE_KEYS[kind]),
                  }))}
                  onValueChange={(resourceType) => {
                    update({ resourceType, resourceIds: [] });
                  }}
                />
                <TextField
                  id={`${prefix}-skills`}
                  label={t('services.requirementSkills')}
                  hint={t('services.requirementSkillsHint')}
                  value={requirement.skills}
                  onChange={(event) => {
                    update({ skills: event.target.value });
                  }}
                />
                <NumberField
                  id={`${prefix}-count`}
                  label={t('services.requirementCount')}
                  value={requirement.count}
                  min={1}
                  max={SERVICE_LIMITS.requirementCountMax}
                  onChange={(count) => {
                    update({ count: count ?? 1 });
                  }}
                />
              </div>
              {candidates.length > 0 && (
                <fieldset className="space-y-1">
                  <legend className="text-xs font-medium text-copy-muted">
                    {t('services.requirementPool')}
                  </legend>
                  <p className="text-xs text-copy-muted">{t('services.requirementPoolHint')}</p>
                  {candidates.map((resource) => (
                    <CheckboxField
                      key={resource.id}
                      id={`${prefix}-res-${resource.id}`}
                      label={resource.name}
                      checked={requirement.resourceIds.includes(resource.id)}
                      onChange={(event) => {
                        update({
                          resourceIds: event.target.checked
                            ? [...requirement.resourceIds, resource.id]
                            : requirement.resourceIds.filter((value) => value !== resource.id),
                        });
                      }}
                    />
                  ))}
                </fieldset>
              )}
              {requirements.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRequirements(requirements.filter((_, position) => position !== index));
                  }}
                >
                  {t('services.removeRequirement')}
                </Button>
              )}
            </div>
          );
        })}
        {requirements.length < SERVICE_LIMITS.requirementsMax && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setRequirements([...requirements, DEFAULT_REQUIREMENT]);
            }}
          >
            {t('services.addRequirement')}
          </Button>
        )}
      </FormSection>

      <FormSection
        title={t('services.sections.capacity')}
        description={t('services.sections.capacityHint')}
      >
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            id={`${id}-per-booking`}
            label={t('services.perBooking')}
            hint={t('services.perBookingHint')}
            value={perBooking}
            min={1}
            max={SERVICE_LIMITS.participantsMax}
            error={errorText('participantsPerBooking')}
            onChange={setPerBooking}
          />
          <NumberField
            id={`${id}-per-session`}
            label={t('services.perSession')}
            hint={t('services.perSessionHint')}
            value={perSession}
            min={1}
            max={SERVICE_LIMITS.participantsMax}
            error={errorText('participantsPerSession')}
            onChange={setPerSession}
          />
        </div>
      </FormSection>

      <FormSection
        title={t('services.sections.information')}
        description={t('services.sections.informationHint')}
      >
        <ul className="space-y-2">
          {INFORMATION_FIELDS.map((field) => {
            const current = information[field];
            const locked = field === 'email';
            return (
              <li key={field} className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <CheckboxField
                  id={`${id}-info-${field}`}
                  label={t(INFORMATION_FIELD_MESSAGE_KEYS[field])}
                  checked={current.enabled}
                  disabled={locked}
                  onChange={(event) => {
                    setInformation({
                      ...information,
                      [field]: {
                        enabled: event.target.checked,
                        isRequired: current.isRequired && event.target.checked,
                      },
                    });
                  }}
                />
                {current.enabled && (
                  <CheckboxField
                    id={`${id}-info-${field}-required`}
                    label={t('services.fieldRequired')}
                    checked={current.isRequired}
                    disabled={locked}
                    onChange={(event) => {
                      setInformation({
                        ...information,
                        [field]: { ...current, isRequired: event.target.checked },
                      });
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-copy-muted">{t('services.emailAlwaysRequired')}</p>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-documents`}>{t('services.documents')}</Label>
          <Textarea
            id={`${id}-documents`}
            value={documents}
            onChange={(event) => {
              setDocuments(event.target.value);
            }}
          />
          <p className="text-xs text-copy-muted">{t('services.documentsHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-instructions`}>{t('services.instructions')}</Label>
          <Textarea
            id={`${id}-instructions`}
            value={instructions}
            maxLength={SERVICE_LIMITS.instructionsMax}
            onChange={(event) => {
              setInstructions(event.target.value);
            }}
          />
          <p className="text-xs text-copy-muted">{t('services.instructionsHint')}</p>
        </div>
      </FormSection>

      <FormSection
        title={t('services.sections.changes')}
        description={t('services.sections.changesHint')}
      >
        <PolicyFields
          idPrefix={`${id}-cancel`}
          title={t('services.cancellation')}
          value={cancellation}
          onChange={setCancellation}
        />
        <PolicyFields
          idPrefix={`${id}-resched`}
          title={t('services.rescheduling')}
          value={rescheduling}
          onChange={setRescheduling}
        />
      </FormSection>

      <FormSection title={t('services.sections.availability')}>
        <CheckboxField
          id={`${id}-own-hours`}
          label={t('services.ownHours')}
          hint={t('services.ownHoursHint')}
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
      </FormSection>

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

interface PolicyFieldsProps {
  readonly idPrefix: string;
  readonly title: string;
  readonly value: PolicyDraft;
  readonly onChange: (next: PolicyDraft) => void;
}

function PolicyFields({ idPrefix, title, value, onChange }: PolicyFieldsProps) {
  const t = useTranslations('booking');
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-copy">{title}</legend>
      <CheckboxField
        id={`${idPrefix}-allowed`}
        label={t('services.policyAllowed')}
        checked={value.isAllowed}
        onChange={(event) => {
          onChange({ ...value, isAllowed: event.target.checked });
        }}
      />
      {value.isAllowed && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumberField
            id={`${idPrefix}-deadline`}
            label={t('services.policyDeadline')}
            hint={t('services.policyDeadlineHint')}
            value={value.deadlineMinutes}
            min={0}
            onChange={(deadlineMinutes) => {
              onChange({ ...value, deadlineMinutes: deadlineMinutes ?? 0 });
            }}
          />
          <fieldset className="space-y-1">
            <legend className="text-xs font-medium text-copy-muted">
              {t('services.policyActors')}
            </legend>
            {CHANGE_ACTORS.map((actor) => (
              <CheckboxField
                key={actor}
                id={`${idPrefix}-actor-${actor}`}
                label={t(CHANGE_ACTOR_MESSAGE_KEYS[actor])}
                checked={value.allowedActors.includes(actor)}
                onChange={(event) => {
                  onChange({
                    ...value,
                    allowedActors: event.target.checked
                      ? [...value.allowedActors, actor]
                      : value.allowedActors.filter((existing) => existing !== actor),
                  });
                }}
              />
            ))}
          </fieldset>
        </div>
      )}
    </fieldset>
  );
}
