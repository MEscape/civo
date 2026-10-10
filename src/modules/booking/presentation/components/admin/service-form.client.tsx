'use client';

import { useId, useState } from 'react';

import { useTranslations } from '@i18n/client';

import { saveServiceAction } from '../../actions/save-service-action';
import { draftOf, toServiceInput } from '../../drafts/service-draft';
import { useErrorText } from '../../hooks/use-error-text';
import { useSaveForm } from '../../hooks/use-save-form';
import { serviceConfigSchema } from '../../schemas/service-config-schema';
import { FormActions } from '../shared/form-actions';
import { FormErrorSummary } from '../shared/form-error-summary';
import { FormSection } from '../shared/form-section';

import { InformationSection } from './information-section';
import { OwnHoursSection } from './own-hours-section';
import { PolicyFields } from './policy-fields';
import { RequirementsSection } from './requirements-section';
import { ServiceBasicsSection } from './service-basics-section';
import { ServiceCapacitySection } from './service-capacity-section';
import { ServiceLocationsSection } from './service-locations-section';
import { ServiceTimingSection } from './service-timing-section';

import type { ServiceDraft } from '../../drafts/service-draft';
import type { LocationDto, ResourceDto, ServiceDto } from '../../dto/setup-dto';

export interface ServiceFormProps {
  readonly websiteId: string;
  readonly locations: readonly LocationDto[];
  readonly resources: readonly ResourceDto[];
  readonly service?: ServiceDto | undefined;
  readonly onSaved: (service: ServiceDto) => void;
  readonly onCancel: () => void;
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
  locations,
  resources,
  service,
  onSaved,
  onCancel,
}: ServiceFormProps) {
  const t = useTranslations('booking');
  const id = useId();
  const [draft, setDraft] = useState(() => draftOf(service, locations));
  const form = useSaveForm({ schema: serviceConfigSchema, save: saveServiceAction, onSaved });
  const errorText = useErrorText(form.errors);

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
      <h3 className="text-base font-medium text-copy">
        {service === undefined ? t('services.new') : t('services.edit')}
      </h3>
      <FormErrorSummary errors={form.errors} shownAtField={SHOWN_AT_FIELD} />

      <ServiceBasicsSection idPrefix={id} draft={draft} errorText={errorText} onChange={update} />
      <ServiceTimingSection idPrefix={id} draft={draft} errorText={errorText} onChange={update} />
      <ServiceLocationsSection
        idPrefix={id}
        locations={locations}
        selectedIds={draft.locationIds}
        error={errorText('locationIds')}
        onChange={(locationIds) => {
          update({ locationIds });
        }}
      />
      <RequirementsSection
        idPrefix={id}
        requirements={draft.requirements}
        resources={resources}
        onChange={(requirements) => {
          update({ requirements });
        }}
      />
      <ServiceCapacitySection idPrefix={id} draft={draft} errorText={errorText} onChange={update} />
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

      <FormSection
        title={t('services.sections.changes')}
        description={t('services.sections.changesHint')}
      >
        <PolicyFields
          idPrefix={`${id}-cancel`}
          title={t('services.cancellation')}
          value={draft.cancellation}
          onChange={(cancellation) => {
            update({ cancellation });
          }}
        />
        <PolicyFields
          idPrefix={`${id}-resched`}
          title={t('services.rescheduling')}
          value={draft.rescheduling}
          onChange={(rescheduling) => {
            update({ rescheduling });
          }}
        />
      </FormSection>

      <FormSection title={t('services.sections.availability')}>
        <OwnHoursSection
          id={`${id}-own-hours`}
          label={t('services.ownHours')}
          hint={t('services.ownHoursHint')}
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
      </FormSection>

      <FormActions isPending={form.isPending} onCancel={onCancel} />
    </form>
  );
}
