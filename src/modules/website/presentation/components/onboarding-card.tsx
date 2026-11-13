import { OnboardingChecklist } from '@components/shared/process-steps';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { ONBOARDING_STEP_MESSAGE_KEYS } from '../messages/message-keys';

type OnboardingStepId = keyof typeof ONBOARDING_STEP_MESSAGE_KEYS;

export interface OnboardingStep {
  readonly id: OnboardingStepId;
  readonly isDone: boolean;
  /** Where the step is done; `null` when it needs no leaving the overview. */
  readonly href: string | null;
}

interface OnboardingCardProps {
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
    <OnboardingChecklist
      title={t('pages.detail.onboarding.title')}
      progressLabel={t('pages.detail.onboarding.progress', { done, total: steps.length })}
      doneLabel={t('pages.detail.onboarding.done')}
      steps={steps.map((step) => ({
        ...step,
        title: t(ONBOARDING_STEP_MESSAGE_KEYS[step.id].title),
        description: t(ONBOARDING_STEP_MESSAGE_KEYS[step.id].description),
        action: step.href !== null && (
          <Link href={step.href} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {t('pages.detail.onboarding.start')}
          </Link>
        ),
      }))}
    />
  );
}
