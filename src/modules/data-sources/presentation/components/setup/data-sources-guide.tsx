'use client';

import { OnboardingChecklist } from '@components/shared/process-steps';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

type GuideStepId = 'source' | 'dataset' | 'mapping' | 'use';

export interface GuideStep {
  readonly id: GuideStepId;
  readonly isDone: boolean;
  /** Where the step is done; only the step to do now has one. */
  readonly href?: string | undefined;
}

interface DataSourcesGuideProps {
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
    <OnboardingChecklist
      title={t('guide.title')}
      progressLabel={progress}
      doneLabel={t('guide.done')}
      steps={steps.map((step) => ({
        id: step.id,
        isDone: step.isDone,
        title: t(`guide.steps.${step.id}.title`),
        description: t(`guide.steps.${step.id}.description`),
        action: step.href !== undefined && (
          <Link href={step.href} className={buttonVariants({ size: 'sm' })}>
            {t(`guide.steps.${step.id}.action`)}
          </Link>
        ),
      }))}
    />
  );
}
