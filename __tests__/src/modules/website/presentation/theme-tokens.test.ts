import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WEBSITE_THEME,
  THEME_FONT_FAMILIES,
} from '@modules/website/domain/models/website-theme';
import { themeToCssVariables } from '@modules/website/presentation/theme/theme-css';

import { PAGE_BACKGROUNDS } from '@lib/utils';

const GLOBALS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
const FONT_LOADERS = readFileSync(join(process.cwd(), 'src/lib/fonts/fonts.ts'), 'utf8');

function token(name: string): string | undefined {
  return new RegExp(`${name}:\\s*([^;]+);`).exec(GLOBALS)?.[1]?.trim().toLowerCase();
}

describe('the default theme', () => {
  it('emits exactly the colour tokens globals.css declares, so chrome outside a ThemeProvider matches', () => {
    const emitted = themeToCssVariables(DEFAULT_WEBSITE_THEME);
    for (const name of [
      '--civo-color-primary',
      '--civo-color-secondary',
      '--civo-color-accent',
      '--civo-color-primary-foreground',
      '--civo-color-secondary-foreground',
      '--civo-color-accent-foreground',
      '--civo-color-primary-copy',
      '--civo-color-secondary-copy',
      '--civo-color-accent-copy',
    ]) {
      expect(emitted[name]?.toLowerCase(), name).toBe(token(name));
    }
  });

  it('derives text colours against the page backgrounds the surface tokens declare', () => {
    expect(PAGE_BACKGROUNDS).toEqual([
      token('--civo-color-surface'),
      token('--civo-color-background'),
    ]);
  });
});

describe('the font choices', () => {
  it('point at a CSS variable a font loader in @lib/fonts declares', () => {
    const declared = new Set(
      [...FONT_LOADERS.matchAll(/variable: '(--[a-z-]+)'/g)].map((match) => match[1]),
    );

    for (const family of THEME_FONT_FAMILIES) {
      const emitted = themeToCssVariables({
        ...DEFAULT_WEBSITE_THEME,
        typography: { ...DEFAULT_WEBSITE_THEME.typography, headingFont: family },
      });
      const referenced = /var\((--[a-z-]+)\)/.exec(emitted['--civo-font-heading'] ?? '')?.[1];

      expect(declared.has(referenced), family).toBe(true);
    }
  });
});
