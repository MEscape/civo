import { I18nProvider } from '@components/providers/i18n-provider';
import { UnsavedChangesProvider } from '@components/providers/unsaved-changes-provider';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { parseNewPageStep } from '../../forms/new-page-steps';

import { CreatePageForm } from './create-page-form.client';

interface CreatePageWizardProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** The raw `?step=` of the address; anything unknown starts at the first step. */
  readonly step: unknown;
}

/** The "new page" wizard with its unsaved-work boundary. The route supplies the page frame. */
export async function CreatePageWizard({ locale, websiteId, step }: CreatePageWizardProps) {
  const t = await getTranslations({ locale, namespace: 'builder' });
  return (
    <I18nProvider locale={locale} namespaces={['builder']}>
      <UnsavedChangesProvider
        title={t('pages.create.leave.title')}
        description={t('pages.create.leave.description')}
        confirmLabel={t('pages.create.leave.confirm')}
        cancelLabel={t('pages.create.leave.stay')}
      >
        <CreatePageForm websiteId={websiteId} step={parseNewPageStep(step)} />
      </UnsavedChangesProvider>
    </I18nProvider>
  );
}
