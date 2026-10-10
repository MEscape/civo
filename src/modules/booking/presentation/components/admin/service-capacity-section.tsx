import { useTranslations } from '@i18n/client';

import { SERVICE_LIMITS } from '../../../application/contracts/booking-constraints';
import { FormSection } from '../shared/form-section';
import { NumberField } from '../shared/number-field';

import type { ServiceDraft } from '../../drafts/service-draft';

export interface ServiceCapacitySectionProps {
  readonly idPrefix: string;
  readonly draft: Pick<ServiceDraft, 'perBooking' | 'perSession'>;
  readonly errorText: (field: string) => string | undefined;
  readonly onChange: (patch: Partial<ServiceDraft>) => void;
}

/** How many people one booking may bring, and how many a shared session holds. */
export function ServiceCapacitySection({
  idPrefix,
  draft,
  errorText,
  onChange,
}: ServiceCapacitySectionProps) {
  const t = useTranslations('booking');

  return (
    <FormSection
      title={t('services.sections.capacity')}
      description={t('services.sections.capacityHint')}
    >
      <div className="grid grid-cols-2 gap-4">
        <NumberField
          id={`${idPrefix}-per-booking`}
          label={t('services.perBooking')}
          hint={t('services.perBookingHint')}
          value={draft.perBooking}
          min={1}
          max={SERVICE_LIMITS.participantsMax}
          error={errorText('participantsPerBooking')}
          onChange={(perBooking) => {
            onChange({ perBooking });
          }}
        />
        <NumberField
          id={`${idPrefix}-per-session`}
          label={t('services.perSession')}
          hint={t('services.perSessionHint')}
          value={draft.perSession}
          min={1}
          max={SERVICE_LIMITS.participantsMax}
          error={errorText('participantsPerSession')}
          onChange={(perSession) => {
            onChange({ perSession });
          }}
        />
      </div>
    </FormSection>
  );
}
