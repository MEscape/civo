'use client';

import { useId, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';
import { FormSelectField } from '@components/shared/form-select-field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import {
  BODY_FONT_FAMILIES,
  THEME_FONT_FAMILIES,
  THEME_RADII,
  THEME_SPACING_SCALES,
} from '../../application/contracts/website-constraints';
import { updateWebsiteThemeAction } from '../actions/update-website-theme-action';
import {
  RADIUS_MESSAGE_KEYS,
  SPACING_MESSAGE_KEYS,
  messageKeyForCode,
} from '../messages/message-keys';
import { themeSettingsSchema } from '../schemas/theme-settings-schema';
import { toPreviewTheme } from '../theme/preview-theme';

import { ColorField } from './color-field';
import { ThemePreview } from './theme-preview';

import type { WebsiteThemeView } from '../../application/contracts/website-views';
import type { ThemeSettings } from '../schemas/theme-settings-schema';

/** A font's name is its own label: font names are not translated. */
function fontOption(font: string) {
  return { value: font, label: font };
}

export interface ThemeSettingsFormProps {
  readonly websiteId: string;
  readonly initialTheme: WebsiteThemeView;
}

export function ThemeSettingsForm({ websiteId, initialTheme }: ThemeSettingsFormProps) {
  const t = useTranslations('website');
  /** A field's error code as text in this module's language; `undefined` while the field is valid. */
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code));

  const headingFontOptions = THEME_FONT_FAMILIES.map(fontOption);
  const bodyFontOptions = BODY_FONT_FAMILIES.map(fontOption);
  const radiusOptions = THEME_RADII.map((radius) => ({
    value: radius,
    label: t(RADIUS_MESSAGE_KEYS[radius]),
  }));
  const spacingOptions = THEME_SPACING_SCALES.map((scale) => ({
    value: scale,
    label: t(SPACING_MESSAGE_KEYS[scale]),
  }));

  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);

  const form = useForm<ThemeSettings>({
    resolver: zodResolver(themeSettingsSchema),
    defaultValues: initialTheme,
  });
  const { isDirty } = form.formState;
  const previewTheme = toPreviewTheme(useWatch({ control: form.control }), initialTheme);

  // Derived, not stored: the confirmation disappears as soon as the user edits again.
  const showSaved = hasSaved && !isDirty;

  function handleSubmit(values: ThemeSettings) {
    setFormErrorCode(null);
    setHasSaved(false);
    startTransition(async () => {
      const result = await updateWebsiteThemeAction({
        websiteId,
        theme: values,
      });
      if (!result.ok) {
        setFormErrorCode(applyActionError(result.error, form.setError));
        return;
      }
      form.reset(result.data.theme);
      setHasSaved(true);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`} className="mb-6 text-xl font-semibold text-copy">
          {t('themeSettings.title')}
        </h2>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          noValidate
          aria-busy={isPending}
          className="space-y-6 rounded-token border border-border bg-surface p-4 sm:p-6"
        >
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-copy">{t('themeSettings.colors')}</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-copy">
              {t('themeSettings.typography')}
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormSelectField
                control={form.control}
                name="typography.headingFont"
                id={`${id}-heading-font`}
                label={t('themeSettings.headingFont')}
                options={headingFontOptions}
                errorText={errorText}
              />
              <FormSelectField
                control={form.control}
                name="typography.bodyFont"
                id={`${id}-body-font`}
                label={t('themeSettings.bodyFont')}
                options={bodyFontOptions}
                errorText={errorText}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-copy">{t('themeSettings.layout')}</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormSelectField
                control={form.control}
                name="radius"
                id={`${id}-radius`}
                label={t('themeSettings.radiusLabel')}
                options={radiusOptions}
                errorText={errorText}
              />
              <FormSelectField
                control={form.control}
                name="spacingScale"
                id={`${id}-spacing`}
                label={t('themeSettings.spacingLabel')}
                options={spacingOptions}
                errorText={errorText}
              />
            </div>
          </fieldset>

          {formErrorCode !== null && (
            <FieldMessage
              id={`${id}-form-error`}
              message={t(messageKeyForCode(formErrorCode))}
              className="text-sm"
            />
          )}
          {showSaved && (
            <p role="status" className="text-sm text-success">
              {t('themeSettings.saved')}
            </p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? t('themeSettings.submitting') : t('themeSettings.submit')}
          </Button>
        </form>
      </section>

      <ThemePreview theme={previewTheme} />
    </div>
  );
}
