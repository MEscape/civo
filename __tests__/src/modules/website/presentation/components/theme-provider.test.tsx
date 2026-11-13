import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DEFAULT_WEBSITE_THEME } from '@modules/website/domain/models/website-theme';
import { ThemeProvider } from '@modules/website/presentation/components/theme-provider';

describe('ThemeProvider', () => {
  it('applies scoped theme tokens and readable foreground colors while preserving its children', () => {
    render(
      <ThemeProvider
        theme={{
          ...DEFAULT_WEBSITE_THEME,
          colors: { ...DEFAULT_WEBSITE_THEME.colors, primary: '#FFFFFF' },
          radius: 'lg',
        }}
      >
        <p>Website content</p>
      </ThemeProvider>,
    );
    const surface = screen.getByText('Website content').closest('[data-civo-theme]');
    if (!(surface instanceof HTMLElement)) {
      throw new Error('Theme scope is missing');
    }
    expect(surface.style.getPropertyValue('--civo-color-primary')).toBe('#FFFFFF');
    expect(surface.style.getPropertyValue('--civo-color-primary-foreground')).toBe('#000000');
    expect(surface.style.getPropertyValue('--civo-radius')).toBe('12px');
    expect(surface.style.fontFamily).toBe('var(--civo-font-body)');
  });
});
