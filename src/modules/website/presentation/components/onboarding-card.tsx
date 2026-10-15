import { OverviewCard, OverviewRow } from '@components/shared/overview-card';
import { ProgressBar } from '@components/shared/progress-bar';
import { buttonVariants } from '@components/ui/button';
import { Check } from '@components/ui/icons';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { cn } from '@lib/utils';

export type OnboardingStepId = 'page' | 'publish' | 'booking' | 'dataSource';

export interface OnboardingStep {
  readonly id: OnboardingStepId;
  readonly isDone: boolean;
  /** Where the step is done; `null` when it needs no leaving the overview. */
  readonly href: string | null;
}

export interface OnboardingCardProps {
  readonly locale: Locale;
  readonly steps: readonly OnboardingStep[];
}

/**
 * The first steps of a new website, ticked off from what actually exists, so
 * they are never out of date. It disappears when the last one is done: an
 * overview is for running a website, not for remembering how it began.
 */
export async function OnboardingCard({ locale, steps }: OnboardingCardProps) {
  const t = await getTranslations({ locale, namespace: 'website' });
  const done = steps.filter((step) => step.isDone).length;
  if (steps.length === 0 || done === steps.length) {
    return null;
  }

  return (
    <OverviewCard title={t('pages.detail.onboarding.title')}>
      <OverviewRow className="space-y-2">
        <p className="text-sm text-copy-muted">
          {t('pages.detail.onboarding.progress', { done, total: steps.length })}
        </p>
        <ProgressBar
          value={done}
          max={steps.length}
          label={t('pages.detail.onboarding.progress', { done, total: steps.length })}
        />
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
              {t(`pages.detail.onboarding.steps.${step.id}.title`)}
            </p>
            {!step.isDone && (
              <p className="text-xs text-copy-muted">
                {t(`pages.detail.onboarding.steps.${step.id}.description`)}
              </p>
            )}
          </div>
          {step.isDone ? (
            <span className="text-xs font-medium text-copy-muted">
              {t('pages.detail.onboarding.done')}
            </span>
          ) : (
            step.href !== null && (
              <Link href={step.href} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                {t('pages.detail.onboarding.start')}
              </Link>
            )
          )}
        </OverviewRow>
      ))}
    </OverviewCard>
  );
}
