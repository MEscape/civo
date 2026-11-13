import { OnboardingChecklist } from '@components/shared/process-steps';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { bookingRoutes } from '../../routes';

import type { PreferencesDto } from '../../dto/employee-dto';

export interface EmployeeSetupGuideProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** What the employee has chosen so far. */
  readonly preferences: Pick<PreferencesDto, 'serviceIds'>;
}

/**
 * The first steps of an employee, shown like the setup of the booking itself: the calendar is there (a
 * manager set it up), and the preferences that order the open bookings are still to be chosen. Gone as
 * soon as the services are chosen; the time window is optional and never holds it up.
 */
export async function EmployeeSetupGuide({
  locale,
  websiteId,
  preferences,
}: EmployeeSetupGuideProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const isPreferenceSet = preferences.serviceIds.length > 0;
  if (isPreferenceSet) {
    return null;
  }
  const steps = [
    {
      id: 'calendar',
      title: t('employee.setup.calendar.title'),
      description: t('employee.setup.calendar.description'),
      isDone: true,
    },
    {
      id: 'preferences',
      title: t('employee.setup.preferences.title'),
      description: t('employee.setup.preferences.description'),
      isDone: isPreferenceSet,
      action: (
        <Link
          href={bookingRoutes.mePreferences(websiteId)}
          className={buttonVariants({ size: 'sm' })}
        >
          {t('employee.setup.preferences.action')}
        </Link>
      ),
    },
  ];
  const done = steps.filter((step) => step.isDone).length;

  return (
    <OnboardingChecklist
      title={t('employee.setup.title')}
      progressLabel={t('setup.progress', { done, total: steps.length })}
      doneLabel={t('setup.done')}
      steps={steps}
    />
  );
}
