import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WEBSITE_ERROR_CODES,
  WEBSITE_VALIDATION_CODES,
} from '@modules/website/application/contracts/website-constraints';
import { DEFAULT_WEBSITE_THEME } from '@modules/website/domain/models/website-theme';
import { updateWebsiteThemeAction } from '@modules/website/presentation/actions/update-website-theme-action';
import { toWebsiteDto } from '@modules/website/presentation/dto/website-dto';
import { useThemeSettingsForm } from '@modules/website/presentation/hooks/use-theme-settings-form';
import en from '@modules/website/presentation/i18n/en.json';

import { websiteView } from '../support/website-view';

vi.mock('@modules/website/presentation/actions/update-website-theme-action', () => ({
  updateWebsiteThemeAction: vi.fn(),
}));
beforeEach(() => vi.mocked(updateWebsiteThemeAction).mockReset());
function wrapper({ children }: { readonly children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}
const render = () =>
  renderHook(
    () => useThemeSettingsForm({ websiteId: 'site-1', initialTheme: DEFAULT_WEBSITE_THEME }),
    { wrapper },
  );

describe('useThemeSettingsForm', () => {
  it('previews complete edits, retains saved colors during partial input, and exposes supported choices', async () => {
    const { result } = render();
    expect(
      result.current.options.bodyFont.some((option) => option.value === 'Source Serif 4'),
    ).toBe(false);
    expect(result.current.options.radius.map((option) => option.value)).toEqual([
      'none',
      'sm',
      'md',
      'lg',
    ]);
    await act(async () => {
      result.current.form.setValue('colors.primary', '#12', { shouldDirty: true });
    });
    expect(result.current.previewTheme.colors.primary).toBe(DEFAULT_WEBSITE_THEME.colors.primary);
    await act(async () => {
      result.current.form.setValue('colors.primary', '#112233', { shouldDirty: true });
    });
    expect(result.current.previewTheme.colors.primary).toBe('#112233');
    expect(result.current.isDirty).toBe(true);
  });

  it('resets to the server-confirmed theme after saving and clears saved feedback on a new edit', async () => {
    const theme = { ...DEFAULT_WEBSITE_THEME, radius: 'lg' as const };
    vi.mocked(updateWebsiteThemeAction).mockResolvedValue({
      ok: true,
      data: toWebsiteDto({ ...websiteView, theme }),
    });
    const { result } = render();
    await act(async () => {
      result.current.form.setValue('radius', 'lg', { shouldDirty: true });
    });
    await act(async () => {
      await result.current.onSubmit();
    });
    expect(updateWebsiteThemeAction).toHaveBeenCalledWith({ websiteId: 'site-1', theme });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.showSaved).toBe(true);
    await act(async () => {
      result.current.form.setValue('radius', 'sm', { shouldDirty: true });
    });
    expect(result.current.showSaved).toBe(false);
  });

  it('preserves dirty values on failure and maps field errors to their controls', async () => {
    vi.mocked(updateWebsiteThemeAction).mockResolvedValue({
      ok: false,
      error: {
        code: WEBSITE_ERROR_CODES.validationFailed,
        message: 'Invalid',
        fieldErrors: { 'colors.primary': [WEBSITE_VALIDATION_CODES.colorInvalid] },
      },
    });
    const { result } = render();
    await act(async () => {
      result.current.form.setValue('colors.primary', '#112233', { shouldDirty: true });
    });
    await act(async () => {
      await result.current.onSubmit();
    });
    expect(result.current.form.getFieldState('colors.primary').error?.message).toBe(
      WEBSITE_VALIDATION_CODES.colorInvalid,
    );
    expect(result.current.isDirty).toBe(true);
    expect(result.current.showSaved).toBe(false);
    expect(result.current.errorText(WEBSITE_VALIDATION_CODES.colorInvalid)).not.toBe(
      WEBSITE_VALIDATION_CODES.colorInvalid,
    );
  });

  it('shows a form-level operational failure', async () => {
    vi.mocked(updateWebsiteThemeAction).mockResolvedValue({
      ok: false,
      error: { code: WEBSITE_ERROR_CODES.persistenceFailed, message: 'Unavailable' },
    });
    const { result } = render();
    await act(async () => {
      await result.current.onSubmit();
    });
    expect(result.current.formError).toBeTruthy();
  });
});
