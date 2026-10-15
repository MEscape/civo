import { useTranslations } from '@i18n/client';

import { SERVICE_LIMITS } from '../../../application/contracts/booking-constraints';
import { exampleStartTimes, slotIntervalChoices } from '../../drafts/start-times';
import { CollapsibleFormSection } from '../shared/collapsible-form-section';
import { NumberField } from '../shared/number-field';
import { OptionSelectField } from '../shared/option-select-field';

import type { ServiceDraft } from '../../drafts/service-draft';

const TIMING_FIELDS = [
  'preparationMinutes',
  'cleanupMinutes',
  'slotIntervalMinutes',
  'noticeMinutes',
  'horizonDays',
] as const;

export interface ServiceTimingSectionProps {
  readonly idPrefix: string;
  readonly draft: Pick<
    ServiceDraft,
    'preparation' | 'cleanup' | 'slotInterval' | 'notice' | 'horizon'
  >;
  readonly errorText: (field: string) => string | undefined;
  readonly onChange: (patch: Partial<ServiceDraft>) => void;
}

/** The buffers around an appointment, the spacing of start times, and how far ahead it can be booked. */
export function ServiceTimingSection({
  idPrefix,
  draft,
  errorText,
  onChange,
}: ServiceTimingSectionProps) {
  const t = useTranslations('booking');
  const examples = exampleStartTimes(draft.slotInterval);

  return (
    <CollapsibleFormSection
      title={t('services.sections.timing')}
      hasProblem={TIMING_FIELDS.some((field) => errorText(field) !== undefined)}
      description={t('services.sections.timingHint')}
      summary={t('services.glance.timing', {
        interval: draft.slotInterval ?? 0,
        horizon: draft.horizon ?? 0,
      })}
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
        <div className="col-span-2 sm:col-span-3">
          <OptionSelectField
            id={`${idPrefix}-interval`}
            label={t('services.slotInterval')}
            hint={[
              t('services.slotIntervalHint'),
              examples.length > 0
                ? t('services.slotIntervalExample', { times: examples.join(', ') })
                : '',
            ]
              .join(' ')
              .trim()}
            value={String(draft.slotInterval ?? '')}
            error={errorText('slotIntervalMinutes')}
            options={slotIntervalChoices(draft.slotInterval).map((minutes) => ({
              value: String(minutes),
              label: t('services.slotIntervalOption', { minutes }),
            }))}
            onValueChange={(slotInterval) => {
              onChange({ slotInterval: Number(slotInterval) });
            }}
          />
        </div>
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
    </CollapsibleFormSection>
  );
}
