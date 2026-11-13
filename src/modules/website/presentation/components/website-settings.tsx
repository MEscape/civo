import { I18nProvider } from '@components/providers/i18n-provider';
import { UnsavedChangesProvider } from '@components/providers/unsaved-changes-provider';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getWebsiteQueries } from '../../composition';
import { loadWebsiteSettings } from '../loaders/load-website-settings';

import { GeneralSettingsForm } from './general-settings-form';
import { ThemeSettingsForm } from './theme-settings-form';

interface WebsiteSettingsProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** Display only. Both save commands authorize their own explicit website target. */
  readonly canEditGeneral: boolean;
  readonly canEditTheme: boolean;
}

/** General and theme forms share one navigation guard so either form's unsaved work remains protected. */
export async function WebsiteSettings({
  locale,
  websiteId,
  canEditGeneral,
  canEditTheme,
}: WebsiteSettingsProps) {
  const [view, t] = await Promise.all([
    loadWebsiteSettings(websiteId, getWebsiteQueries()),
    getTranslations({ locale, namespace: 'website' }),
  ]);
  return (
    <I18nProvider locale={locale} namespaces={['website']}>
      <UnsavedChangesProvider
        title={t('pages.settings.leave.title')}
        description={t('pages.settings.leave.description')}
        confirmLabel={t('pages.settings.leave.confirm')}
        cancelLabel={t('pages.settings.leave.stay')}
      >
        <div className="space-y-6">
          {canEditGeneral && (
            <GeneralSettingsForm
              websiteId={view.website.id}
              initialValues={view.initialValues}
              slug={view.website.slug}
            />
          )}
          {canEditTheme && (
            <ThemeSettingsForm websiteId={view.website.id} initialTheme={view.website.theme} />
          )}
        </div>
      </UnsavedChangesProvider>
    </I18nProvider>
  );
}
