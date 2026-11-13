'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { useReportUnsavedChanges } from '@hooks/use-unsaved-changes';

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
  MESSAGE_PARAMS,
  RADIUS_MESSAGE_KEYS,
  SPACING_MESSAGE_KEYS,
  messageKeyForCode,
} from '../messages/message-keys';
import { themeSettingsSchema } from '../schemas/theme-settings-schema';
import { toPreviewTheme } from '../theme/preview-theme';

import type { WebsiteThemeView } from '../../application/contracts/website-views';
import type { ThemeSettings } from '../schemas/theme-settings-schema';

interface ThemeSettingsFormOptions {
  readonly websiteId: string;
  readonly initialTheme: WebsiteThemeView;
}

/** A font's name is its own label: font names are not translated. */
function fontOption(font: string) {
  return { value: font, label: font };
}

/**
 * The website's theme as a form: the choices of each select, the live preview of what is being
 * edited, saving, the form-level refusal, the "saved" note and the unsaved-work guard.
 */
export function useThemeSettingsForm({ websiteId, initialTheme }: ThemeSettingsFormOptions) {
  const t = useTranslations('website');
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);

  const form = useForm<ThemeSettings>({
    resolver: zodResolver(themeSettingsSchema),
    defaultValues: initialTheme,
  });
  const { isDirty } = form.formState;
  useReportUnsavedChanges(isDirty);
  const previewTheme = toPreviewTheme(useWatch({ control: form.control }), initialTheme);

  /** A field's error code as text in this module's language; `undefined` while the field is valid. */
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

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

  return {
    form,
    isPending,
    isDirty,
    previewTheme,
    errorText,
    formError: errorText(formErrorCode ?? undefined),
    // Derived, not stored: the confirmation disappears as soon as the user edits again.
    showSaved: hasSaved && !isDirty,
    options: {
      headingFont: THEME_FONT_FAMILIES.map(fontOption),
      bodyFont: BODY_FONT_FAMILIES.map(fontOption),
      radius: THEME_RADII.map((radius) => ({
        value: radius,
        label: t(RADIUS_MESSAGE_KEYS[radius]),
      })),
      spacing: THEME_SPACING_SCALES.map((scale) => ({
        value: scale,
        label: t(SPACING_MESSAGE_KEYS[scale]),
      })),
    },
    onSubmit: form.handleSubmit(handleSubmit),
  };
}
