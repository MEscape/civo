import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { DEFAULT_WEBSITE_THEME } from '@modules/website/domain/models/website-theme';
import { ThemePreview } from '@modules/website/presentation/components/theme-preview';
import en from '@modules/website/presentation/i18n/en.json';

describe('ThemePreview', () => {
  it('shows translated theme samples without presenting decorative controls to keyboard or screen-reader users', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        <ThemePreview theme={DEFAULT_WEBSITE_THEME} />
      </NextIntlClientProvider>,
    );
    expect(
      screen.getByRole('heading', { name: en.website.themeSettings.previewTitle }),
    ).toBeInTheDocument();
    const sample = screen.getByText(en.website.themeSettings.preview.heading);
    expect(sample.closest('[aria-hidden="true"]')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
