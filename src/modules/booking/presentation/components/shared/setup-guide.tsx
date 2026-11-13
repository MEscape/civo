import { OnboardingChecklist } from '@components/shared/process-steps';
import { Alert } from '@components/ui/alert';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { setupSteps } from './setup-steps';

import type { BookingSetupView } from '../../../application/contracts/service-views';

export interface SetupGuideProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly setup: BookingSetupView;
}

/**
 * The way through a first booking setup: a location, then the services and resources that belong to
 * it, then the team. Each step offers the one action that does it, including the location it needs,
 * so nobody has to know in advance that services and resources live under a location. Gone once
 * everything is in place. The caller shows it only to people who may configure.
 */
export async function SetupGuide({ locale, websiteId, setup }: SetupGuideProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const steps = setupSteps(t, websiteId, setup);
  const done = steps.filter((step) => step.isDone).length;
  if (done === steps.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      <OnboardingChecklist
        title={t('setup.title')}
        progressLabel={t('setup.progress', { done, total: steps.length })}
        doneLabel={t('setup.done')}
        steps={steps}
      />
      {setup.isTruncated && (
        <Alert variant="warning" role="status">
          {t('setup.truncated')}
        </Alert>
      )}
    </div>
  );
}
