'use client';

import { useId } from 'react';

import { DataPanel, DataPanelSaveFooter } from '@components/shared/data-panel';
import { FormSelectField } from '@components/shared/select-field';

import { useTranslations } from '@i18n/client';

import { useThemeSettingsForm } from '../hooks/use-theme-settings-form';

import { ColorField } from './color-field';
import { ThemePreview } from './theme-preview';

import type { WebsiteThemeView } from '../../application/contracts/website-views';

interface ThemeSettingsFormProps {
  readonly websiteId: string;
  readonly initialTheme: WebsiteThemeView;
}

export function ThemeSettingsForm({ websiteId, initialTheme }: ThemeSettingsFormProps) {
  const t = useTranslations('website');
  const id = useId();
  const theme = useThemeSettingsForm({ websiteId, initialTheme });
  const { form, isPending, isDirty, errorText, options } = theme;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <DataPanel title={t('themeSettings.title')} description={t('themeSettings.description')}>
        <form onSubmit={theme.onSubmit} noValidate aria-busy={isPending}>
          <div className="divide-y divide-border">
            <fieldset className="p-4 sm:p-6">
              <legend className="float-left mb-4 w-full text-xs font-semibold uppercase tracking-wide text-copy-muted">
                {t('themeSettings.colors')}
              </legend>
              <div className="clear-both grid grid-cols-1 gap-4 sm:grid-cols-3">
                <ColorField
                  control={form.control}
                  name="colors.primary"
                  label={t('themeSettings.primary')}
                />
                <ColorField
                  control={form.control}
                  name="colors.secondary"
                  label={t('themeSettings.secondary')}
                />
                <ColorField
                  control={form.control}
                  name="colors.accent"
                  label={t('themeSettings.accent')}
                />
              </div>
            </fieldset>

            <fieldset className="p-4 sm:p-6">
              <legend className="float-left mb-4 w-full text-xs font-semibold uppercase tracking-wide text-copy-muted">
                {t('themeSettings.typography')}
              </legend>
              <div className="clear-both grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormSelectField
                  control={form.control}
                  name="typography.headingFont"
                  id={`${id}-heading-font`}
                  label={t('themeSettings.headingFont')}
                  options={options.headingFont}
                  errorText={errorText}
                />
                <FormSelectField
                  control={form.control}
                  name="typography.bodyFont"
                  id={`${id}-body-font`}
                  label={t('themeSettings.bodyFont')}
                  options={options.bodyFont}
                  errorText={errorText}
                />
              </div>
            </fieldset>

            <fieldset className="p-4 sm:p-6">
              <legend className="float-left mb-4 w-full text-xs font-semibold uppercase tracking-wide text-copy-muted">
                {t('themeSettings.layout')}
              </legend>
              <div className="clear-both grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormSelectField
                  control={form.control}
                  name="radius"
                  id={`${id}-radius`}
                  label={t('themeSettings.radiusLabel')}
                  options={options.radius}
                  errorText={errorText}
                />
                <FormSelectField
                  control={form.control}
                  name="spacingScale"
                  id={`${id}-spacing`}
                  label={t('themeSettings.spacingLabel')}
                  options={options.spacing}
                  errorText={errorText}
                />
              </div>
            </fieldset>
          </div>

          <DataPanelSaveFooter
            id={id}
            isPending={isPending}
            isDirty={isDirty}
            showSaved={theme.showSaved}
            savedLabel={t('themeSettings.saved')}
            unsavedLabel={t('settingsActions.unsaved')}
            submitLabel={isPending ? t('themeSettings.submitting') : t('themeSettings.submit')}
            error={theme.formError}
          />
        </form>
      </DataPanel>

      <ThemePreview theme={theme.previewTheme} />
    </div>
  );
}
