import { zodResolver } from '@hookform/resolvers/zod';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { DEFAULT_WEBSITE_THEME } from '@modules/website/domain/models/website-theme';
import { ColorField } from '@modules/website/presentation/components/color-field';
import en from '@modules/website/presentation/i18n/en.json';
import { themeSettingsSchema } from '@modules/website/presentation/schemas/theme-settings-schema';
import type { ThemeSettings } from '@modules/website/presentation/schemas/theme-settings-schema';

function Field() {
  const form = useForm<ThemeSettings>({
    defaultValues: DEFAULT_WEBSITE_THEME,
    resolver: zodResolver(themeSettingsSchema),
    mode: 'onChange',
  });
  return <ColorField control={form.control} name="colors.primary" label="Primary" />;
}

describe('ColorField', () => {
  it('keeps text and picker synchronized, uses a safe picker value during partial input, and clears corrected validation errors', async () => {
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        <Field />
      </NextIntlClientProvider>,
    );
    const text = screen.getByLabelText('Primary');
    const picker = screen.getByLabelText('Primary: choose color');
    fireEvent.change(text, { target: { value: '#12' } });
    expect(text).toHaveValue('#12');
    expect(picker).toHaveValue('#000000');
    await waitFor(() => expect(text).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.change(picker, { target: { value: '#112233' } });
    expect(text).toHaveValue('#112233');
    await waitFor(() => expect(text).not.toHaveAttribute('aria-invalid'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
