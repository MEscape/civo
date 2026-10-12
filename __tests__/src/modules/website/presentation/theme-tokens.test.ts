import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_WEBSITE_THEME } from '@modules/website/domain/models/website-theme';
import { themeToCssVariables } from '@modules/website/presentation/theme/theme-css';

import { PAGE_BACKGROUNDS } from '@lib/utils';

const GLOBALS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

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
