import { useTranslations } from '@i18n/client';

import { SERVICE_LIMITS } from '../../../application/contracts/booking-constraints';
import { FormSection } from '../shared/form-section';
import { NumberField } from '../shared/number-field';

import type { ServiceDraft } from '../../drafts/service-draft';

export interface ServiceTimingSectionProps {
  readonly idPrefix: string;
  readonly draft: Pick<
    ServiceDraft,
    'duration' | 'preparation' | 'cleanup' | 'slotInterval' | 'notice' | 'horizon'
  >;
  readonly errorText: (field: string) => string | undefined;
  readonly onChange: (patch: Partial<ServiceDraft>) => void;
}

/** How long an appointment lasts, the buffers around it, and how far ahead it can be booked. */
export function ServiceTimingSection({
  idPrefix,
  draft,
  errorText,
  onChange,
}: ServiceTimingSectionProps) {
  const t = useTranslations('booking');

  return (
    <FormSection
      title={t('services.sections.timing')}
      description={t('services.sections.timingHint')}
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <NumberField
          id={`${idPrefix}-duration`}
          label={t('services.duration')}
          value={draft.duration}
          min={SERVICE_LIMITS.durationMin}
          max={SERVICE_LIMITS.durationMax}
          error={errorText('durationMinutes')}
          onChange={(duration) => {
            onChange({ duration });
          }}
        />
        <NumberField
          id={`${idPrefix}-preparation`}
          label={t('services.preparation')}
          hint={t('services.preparationHint')}
          value={draft.preparation}
          min={0}
          max={SERVICE_LIMITS.bufferMax}
          error={errorText('preparationMinutes')}
          onChange={(preparation) => {
            onChange({ preparation });
          }}
        />
        <NumberField
          id={`${idPrefix}-cleanup`}
          label={t('services.cleanup')}
          hint={t('services.cleanupHint')}
          value={draft.cleanup}
          min={0}
          max={SERVICE_LIMITS.bufferMax}
          error={errorText('cleanupMinutes')}
          onChange={(cleanup) => {
            onChange({ cleanup });
          }}
        />
        <NumberField
          id={`${idPrefix}-interval`}
          label={t('services.slotInterval')}
          hint={t('services.slotIntervalHint')}
          value={draft.slotInterval}
          min={SERVICE_LIMITS.slotIntervalMin}
          max={SERVICE_LIMITS.slotIntervalMax}
          error={errorText('slotIntervalMinutes')}
          onChange={(slotInterval) => {
            onChange({ slotInterval });
          }}
        />
        <NumberField
          id={`${idPrefix}-notice`}
          label={t('services.notice')}
          hint={t('services.noticeHint')}
          value={draft.notice}
          min={0}
          error={errorText('noticeMinutes')}
          onChange={(notice) => {
            onChange({ notice });
          }}
        />
        <NumberField
          id={`${idPrefix}-horizon`}
          label={t('services.horizon')}
          hint={t('services.horizonHint')}
          value={draft.horizon}
          min={1}
          max={SERVICE_LIMITS.horizonDaysMax}
          error={errorText('horizonDays')}
          onChange={(horizon) => {
            onChange({ horizon });
          }}
        />
      </div>
    </FormSection>
  );
}
