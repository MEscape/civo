import { I18nProvider } from '@components/providers/i18n-provider';
import { UnsavedChangesProvider } from '@components/providers/unsaved-changes-provider';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { parseNewWebsiteStep } from '../forms/new-website-steps';

import { CreateWebsiteForm } from './create-website-form';

interface CreateWebsiteWizardProps {
  readonly locale: Locale;
  /** The raw `?step=` of the address; anything unknown starts at the first step. */
  readonly step: unknown;
}

/** The "new website" wizard with its unsaved-work boundary. The route supplies the page frame. */
export async function CreateWebsiteWizard({ locale, step }: CreateWebsiteWizardProps) {
  const t = await getTranslations({ locale, namespace: 'website' });
  return (
    <I18nProvider locale={locale} namespaces={['website']}>
      <UnsavedChangesProvider
        title={t('pages.create.leave.title')}
        description={t('pages.create.leave.description')}
        confirmLabel={t('pages.create.leave.confirm')}
        cancelLabel={t('pages.create.leave.stay')}
      >
        <CreateWebsiteForm step={parseNewWebsiteStep(step)} />
      </UnsavedChangesProvider>
    </I18nProvider>
  );
}
