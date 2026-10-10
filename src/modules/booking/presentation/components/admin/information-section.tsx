import { CheckboxField } from '@components/shared/checkbox-field';
import { Label, Textarea } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import {
  INFORMATION_FIELDS,
  SERVICE_LIMITS,
} from '../../../application/contracts/booking-constraints';
import { INFORMATION_FIELD_MESSAGE_KEYS } from '../../messages/message-keys';
import { FormSection } from '../shared/form-section';

import type { InformationDraft } from '../../drafts/service-draft';

export interface InformationSectionProps {
  readonly idPrefix: string;
  readonly information: InformationDraft;
  readonly documents: string;
  readonly instructions: string;
  readonly onInformationChange: (next: InformationDraft) => void;
  readonly onDocumentsChange: (next: string) => void;
  readonly onInstructionsChange: (next: string) => void;
}

/** What a visitor is asked for, the documents to bring, and the instructions they are shown. */
export function InformationSection({
  idPrefix,
  information,
  documents,
  instructions,
  onInformationChange,
  onDocumentsChange,
  onInstructionsChange,
}: InformationSectionProps) {
  const t = useTranslations('booking');

  return (
    <FormSection
      title={t('services.sections.information')}
      description={t('services.sections.informationHint')}
    >
      <ul className="space-y-2">
        {INFORMATION_FIELDS.map((field) => {
          const current = information[field];
          // A booking cannot be confirmed without an email address.
          const isLocked = field === 'email';
          return (
            <li key={field} className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <CheckboxField
                id={`${idPrefix}-info-${field}`}
                label={t(INFORMATION_FIELD_MESSAGE_KEYS[field])}
                checked={current.enabled}
                disabled={isLocked}
                onChange={(event) => {
                  onInformationChange({
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
                  id={`${idPrefix}-info-${field}-required`}
                  label={t('services.fieldRequired')}
                  checked={current.isRequired}
                  disabled={isLocked}
                  onChange={(event) => {
                    onInformationChange({
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
        <Label htmlFor={`${idPrefix}-documents`}>{t('services.documents')}</Label>
        <Textarea
          id={`${idPrefix}-documents`}
          value={documents}
          onChange={(event) => {
            onDocumentsChange(event.target.value);
          }}
        />
        <p className="text-xs text-copy-muted">{t('services.documentsHint')}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-instructions`}>{t('services.instructions')}</Label>
        <Textarea
          id={`${idPrefix}-instructions`}
          value={instructions}
          maxLength={SERVICE_LIMITS.instructionsMax}
          onChange={(event) => {
            onInstructionsChange(event.target.value);
          }}
        />
        <p className="text-xs text-copy-muted">{t('services.instructionsHint')}</p>
      </div>
    </FormSection>
  );
}
