'use client';

import { useId, useState } from 'react';

import { useTranslations } from '@i18n/client';

import { deleteServiceAction } from '../../actions/delete-service-action';
import { saveServiceAction } from '../../actions/save-service-action';
import { isEmptyPlan } from '../../drafts/availability-plan-form';
import { policyReachOf } from '../../drafts/policy-deadlines';
import { withServicePreset } from '../../drafts/preset-drafts';
import { draftOf, feasibilityQueryOf, toServiceInput } from '../../drafts/service-draft';
import { useDraftGuard } from '../../hooks/use-draft-guard';
import { useErrorText } from '../../hooks/use-error-text';
import { useSaveForm } from '../../hooks/use-save-form';
import { useServiceFeasibility } from '../../hooks/use-service-feasibility';
import { serviceConfigSchema } from '../../schemas/service-config-schema';
import { CollapsibleFormSection } from '../shared/collapsible-form-section';
import { DeleteEntityButton } from '../shared/delete-entity-button';
import { FormActions } from '../shared/form-actions';
import { FormErrorSummary, hasErrorsUnder } from '../shared/form-error-summary';

import { InformationSection } from './information-section';
import { OwnHoursSection } from './own-hours-section';
import { PolicyFields } from './policy-fields';
import { RequirementsSection } from './requirements-section';
import { ServiceBasicsSection } from './service-basics-section';
import { ServiceCapacitySection } from './service-capacity-section';
import { ServiceFeasibilityPanel } from './service-feasibility-panel';
import { ServiceTimingSection } from './service-timing-section';

import type { ServiceDraft } from '../../drafts/service-draft';
import type { LocationOption, ResourceOption, ServiceDto } from '../../dto/setup-dto';
import type { AvailabilityPlanForm } from '../../schemas/availability-plan-schema';
import type { FormErrors } from '../shared/form-error-summary';

export interface ServiceFormProps {
  readonly websiteId: string;
  /** The place the service is being made or changed at. */
  readonly location: LocationOption;
  /** The week this place is open: the service's own hours can only be narrower. */
  readonly locationHours: AvailabilityPlanForm['weekly'];
  readonly resources: readonly ResourceOption[];
  /** The categories other services already use. */
  readonly categories: readonly string[];
  readonly service?: ServiceDto | undefined;
  /** The template a new service starts from. */
  readonly presetKey?: string | undefined;
  readonly onSaved: (service: ServiceDto) => void;
  readonly onCancel: () => void;
  /** Problems found before the form was shown, so the parts at fault are marked from the start. */
  readonly initialErrors?: FormErrors;
}

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

/**
 * Create or edit a bookable service. The whole form is one draft, edited by
 * the sections it is made of; nothing is sent until save, and the schema and
 * the server check it again.
 */
export function ServiceForm({
  websiteId,
  location,
  locationHours,
  resources,
  categories,
  service,
  presetKey,
  onSaved,
  onCancel,
  initialErrors,
}: ServiceFormProps) {
  const t = useTranslations('booking');
  const id = useId();
  const serving = resources.filter(
    (resource) => resource.locationId === null || resource.locationId === location.id,
  );
  const otherLocations = (service?.locationIds ?? []).filter(
    (locationId) => locationId !== location.id,
  ).length;
  const [draft, setDraft] = useState(() =>
    withServicePreset(draftOf(service, location.id), {
      presetKey,
      name: presetKey === undefined ? '' : t(`presets.services.${presetKey}` as never),
      availableTypes: [...new Set(serving.map((resource) => resource.type))],
    }),
  );

  useDraftGuard(draft);
  const form = useSaveForm({
    schema: serviceConfigSchema,
    save: saveServiceAction,
    onSaved,
    ...(initialErrors === undefined ? {} : { initialErrors }),
  });
  const errorText = useErrorText(form.errors);
  const feasibility = useServiceFeasibility(feasibilityQueryOf(websiteId, service?.id, draft));

  function update(patch: Partial<ServiceDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  return (
    <form
      noValidate
      aria-busy={form.isPending}
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        form.submit(toServiceInput(websiteId, service?.id, draft));
      }}
    >
      <header className="space-y-1">
        <h3 className="text-base font-medium text-copy">
          {service === undefined ? t('services.new') : t('services.edit')}
        </h3>
        <p className="text-sm text-copy-muted">
          {t('services.atLocation', { name: location.name })}
        </p>
        {otherLocations > 0 && (
          <p role="note" className="text-sm text-copy-muted">
            {t('services.sharedNote', { count: otherLocations })}
          </p>
        )}
      </header>
      <FormErrorSummary errors={form.errors} shownAtField={SHOWN_AT_FIELD} />

      <ServiceBasicsSection
        idPrefix={id}
        draft={draft}
        categories={categories}
        errorText={errorText}
        onChange={update}
      />
      <RequirementsSection
        idPrefix={id}
        requirements={draft.requirements}
        resources={serving}
        onChange={(requirements) => {
          update({ requirements });
        }}
      />
      <ServiceCapacitySection idPrefix={id} draft={draft} errorText={errorText} onChange={update} />
      <ServiceFeasibilityPanel state={feasibility} participantsPerBooking={draft.perBooking} />

      <h4 className="pt-2 text-sm font-medium text-copy">{t('services.sections.more')}</h4>
      <ServiceTimingSection idPrefix={id} draft={draft} errorText={errorText} onChange={update} />
      <InformationSection
        idPrefix={id}
        information={draft.information}
        documents={draft.documents}
        instructions={draft.instructions}
        onInformationChange={(information) => {
          update({ information });
        }}
        onDocumentsChange={(documents) => {
          update({ documents });
        }}
        onInstructionsChange={(instructions) => {
          update({ instructions });
        }}
      />

      <CollapsibleFormSection
        title={t('services.sections.changes')}
        description={t('services.sections.changesHint')}
        summary={t(
          policyReachOf(draft.cancellation) === 'staffOnly' ||
            policyReachOf(draft.cancellation) === 'nobody'
            ? 'services.glance.changesStaffOnly'
            : 'services.glance.changesCustomers',
        )}
      >
        <PolicyFields
          idPrefix={`${id}-cancel`}
          kind="cancel"
          title={t('services.cancellation')}
          value={draft.cancellation}
          onChange={(cancellation) => {
            update({ cancellation });
          }}
        />
        <PolicyFields
          idPrefix={`${id}-resched`}
          kind="move"
          title={t('services.rescheduling')}
          value={draft.rescheduling}
          onChange={(rescheduling) => {
            update({ rescheduling });
          }}
        />
      </CollapsibleFormSection>

      <CollapsibleFormSection
        title={t('services.sections.availability')}
        hasProblem={hasErrorsUnder(form.errors, 'availability')}
        summary={t(draft.hasOwnHours ? 'services.glance.hoursOwn' : 'services.glance.hoursSame')}
      >
        <OwnHoursSection
          id={`${id}-own-hours`}
          label={t('services.ownHours')}
          hint={t('services.ownHoursHint')}
          isEnabled={draft.hasOwnHours}
          plan={draft.availability}
          bounds={locationHours}
          disabled={form.isPending}
          errors={form.errors}
          onEnabledChange={(hasOwnHours) => {
            update({
              hasOwnHours,
              // Narrowing starts from the whole of the location's week, not from nothing.
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
      </CollapsibleFormSection>

      <FormActions
        isPending={form.isPending}
        onCancel={onCancel}
        removal={
          service === undefined ? undefined : (
            <DeleteEntityButton
              kind="service"
              name={service.name}
              onDelete={() => deleteServiceAction({ websiteId, id: service.id })}
              onDeleted={onCancel}
            />
          )
        }
      />
    </form>
  );
}
