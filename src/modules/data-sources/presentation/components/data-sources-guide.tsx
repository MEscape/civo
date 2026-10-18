'use client';

import { OverviewCard, OverviewRow } from '@components/shared/overview-card';
import { ProgressBar } from '@components/shared/progress-bar';
import { Check } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

export type GuideStepId = 'source' | 'dataset' | 'mapping' | 'use';

export interface GuideStep {
  readonly id: GuideStepId;
  readonly isDone: boolean;
}

export interface DataSourcesGuideProps {
  readonly steps: readonly GuideStep[];
}

/**
 * How data reaches a page, ticked off from what exists: the overview's
 * onboarding card, step for step, so both read the same. The last step is
 * ticked once a page uses a dataset; the caller swaps the guide for a
 * "ready" note when every step is done.
 */
export function DataSourcesGuide({ steps }: DataSourcesGuideProps) {
  const t = useTranslations('dataSources');
  const done = steps.filter((step) => step.isDone).length;
  const progress = t('guide.progress', { done, total: steps.length });

  return (
    <OverviewCard title={t('guide.title')}>
      <OverviewRow className="space-y-2">
        <p className="text-sm text-copy-muted">{progress}</p>
        <ProgressBar value={done} max={steps.length} label={progress} />
      </OverviewRow>
      {steps.map((step) => (
        <OverviewRow key={step.id} className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-full border',
              step.isDone
                ? 'border-success-border bg-success-subtle text-success'
                : 'border-border-strong',
            )}
          >
            {step.isDone && <Check className="size-3" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn('text-sm font-medium', step.isDone ? 'text-copy-muted' : 'text-copy')}>
              {t(`guide.steps.${step.id}.title`)}
            </p>
            {!step.isDone && (
              <p className="text-xs text-copy-muted">{t(`guide.steps.${step.id}.description`)}</p>
            )}
          </div>
          {step.isDone && (
            <span className="text-xs font-medium text-copy-muted">{t('guide.done')}</span>
          )}
        </OverviewRow>
      ))}
    </OverviewCard>
  );
}
