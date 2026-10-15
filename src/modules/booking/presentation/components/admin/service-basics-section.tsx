import { CheckboxField } from '@components/shared/checkbox-field';
import { ComboboxField } from '@components/shared/combobox-field';
import { TextField } from '@components/shared/text-field';
import { Label, Textarea } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { SERVICE_LIMITS } from '../../../application/contracts/booking-constraints';
import { skillChoices, toSkillKey } from '../../drafts/skill-key';
import { FormSection } from '../shared/form-section';
import { NumberField } from '../shared/number-field';

import type { ServiceDraft } from '../../drafts/service-draft';

export interface ServiceBasicsSectionProps {
  readonly idPrefix: string;
  readonly draft: Pick<ServiceDraft, 'name' | 'category' | 'description' | 'isActive' | 'duration'>;
  /** The categories other services already use. */
  readonly categories: readonly string[];
  readonly errorText: (field: string) => string | undefined;
  readonly onChange: (patch: Partial<ServiceDraft>) => void;
}

/** Name, category, description and whether the service can be booked at all. */
export function ServiceBasicsSection({
  idPrefix,
  draft,
  categories,
  errorText,
  onChange,
}: ServiceBasicsSectionProps) {
  const t = useTranslations('booking');

  return (
    <FormSection title={t('services.sections.basics')}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id={`${idPrefix}-name`}
          label={t('services.name')}
          value={draft.name}
          error={errorText('name')}
          onChange={(event) => {
            onChange({ name: event.target.value });
          }}
        />
        <NumberField
          id={`${idPrefix}-duration`}
          label={t('services.duration')}
          hint={t('services.durationHint')}
          value={draft.duration}
          min={SERVICE_LIMITS.durationMin}
          max={SERVICE_LIMITS.durationMax}
          error={errorText('durationMinutes')}
          onChange={(duration) => {
            onChange({ duration });
          }}
        />
        <ComboboxField
          selectionMode="single"
          id={`${idPrefix}-category`}
          label={t('services.category')}
          hint={t('services.categoryHint')}
          placeholder={t('services.categoryPlaceholder')}
          error={errorText('category')}
          options={skillChoices(categories, draft.category === '' ? [] : [draft.category])}
          value={draft.category}
          emptyText={t('form.noMatches')}
          createText={(value) => t('form.addValue', { value })}
          normalizeCreated={toSkillKey}
          onValueChange={(category) => {
            onChange({ category });
          }}
        />
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-description`}>{t('services.description')}</Label>
          <Textarea
            id={`${idPrefix}-description`}
            value={draft.description}
            maxLength={SERVICE_LIMITS.descriptionMax}
            onChange={(event) => {
              onChange({ description: event.target.value });
            }}
          />
        </div>
        <CheckboxField
          id={`${idPrefix}-active`}
          label={t('services.active')}
          hint={t('services.activeHint')}
          checked={draft.isActive}
          onChange={(event) => {
            onChange({ isActive: event.target.checked });
          }}
        />
      </div>
    </FormSection>
  );
}
