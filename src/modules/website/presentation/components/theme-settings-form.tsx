'use client';

import { useId, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';
import { SelectField } from '@components/shared/select-field';
import { Button } from '@components/ui/button';

import { useRouter } from '@i18n';

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

export interface ThemeSettingsFormProps {
  readonly websiteId: string;
  readonly initialTheme: WebsiteThemeView;
}

export function ThemeSettingsForm({ websiteId, initialTheme }: ThemeSettingsFormProps) {
  const t = useTranslations('website');
  /** A field's error code as text in this module's language; `undefined` while the field is valid. */
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code));

  const router = useRouter();
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);

  const form = useForm<ThemeSettings>({
    resolver: zodResolver(themeSettingsSchema),
    defaultValues: initialTheme,
  });
  const { errors, isDirty } = form.formState;
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
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <section aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`} className="mb-6 text-xl font-semibold text-copy">
          {t('themeSettings.title')}
        </h2>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          noValidate
          aria-busy={isPending}
          className="space-y-6 rounded-token border border-border bg-surface p-6"
        >
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-copy">{t('themeSettings.colors')}</legend>
            <div className="grid grid-cols-3 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
              <SelectField
                id={`${id}-heading-font`}
                label={t('themeSettings.headingFont')}
                errorMessage={errorText(errors.typography?.headingFont?.message)}
                {...form.register('typography.headingFont')}
              >
                {THEME_FONT_FAMILIES.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id={`${id}-body-font`}
                label={t('themeSettings.bodyFont')}
                errorMessage={errorText(errors.typography?.bodyFont?.message)}
                {...form.register('typography.bodyFont')}
              >
                {BODY_FONT_FAMILIES.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </SelectField>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-copy">{t('themeSettings.layout')}</legend>
            <div className="grid grid-cols-2 gap-4">
              <SelectField
                id={`${id}-radius`}
                label={t('themeSettings.radiusLabel')}
                errorMessage={errorText(errors.radius?.message)}
                {...form.register('radius')}
              >
                {THEME_RADII.map((radius) => (
                  <option key={radius} value={radius}>
                    {t(RADIUS_MESSAGE_KEYS[radius])}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id={`${id}-spacing`}
                label={t('themeSettings.spacingLabel')}
                errorMessage={errorText(errors.spacingScale?.message)}
                {...form.register('spacingScale')}
              >
                {THEME_SPACING_SCALES.map((scale) => (
                  <option key={scale} value={scale}>
                    {t(SPACING_MESSAGE_KEYS[scale])}
                  </option>
                ))}
              </SelectField>
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
