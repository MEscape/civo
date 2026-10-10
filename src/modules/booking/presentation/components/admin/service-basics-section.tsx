import { CheckboxField } from '@components/shared/checkbox-field';
import { TextField } from '@components/shared/text-field';
import { Label, Textarea } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { SERVICE_LIMITS } from '../../../application/contracts/booking-constraints';
import { FormSection } from '../shared/form-section';

import type { ServiceDraft } from '../../drafts/service-draft';

export interface ServiceBasicsSectionProps {
  readonly idPrefix: string;
  readonly draft: Pick<ServiceDraft, 'name' | 'category' | 'description' | 'isActive'>;
  readonly errorText: (field: string) => string | undefined;
  readonly onChange: (patch: Partial<ServiceDraft>) => void;
}

/** Name, category, description and whether the service can be booked at all. */
export function ServiceBasicsSection({
  idPrefix,
  draft,
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
        <TextField
          id={`${idPrefix}-category`}
          label={t('services.category')}
          hint={t('services.categoryHint')}
          value={draft.category}
          error={errorText('category')}
          onChange={(event) => {
            onChange({ category: event.target.value });
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
