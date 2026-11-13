import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import de from '@modules/component-platform/presentation/i18n/de.json';
import en from '@modules/component-platform/presentation/i18n/en.json';
import { translateComponentLabels } from '@modules/component-platform/presentation/loaders/translate-component-labels';

vi.mock('@i18n/server', () => ({
  getTranslations: async ({ locale }: { locale: 'en' | 'de' }) =>
    createTranslator({
      locale,
      messages: locale === 'de' ? de : en,
      namespace: 'componentPlatform',
    }),
}));

describe('component label translation', () => {
  it.each(['en', 'de'] as const)(
    'resolves fully qualified catalog keys inside the %s namespace',
    async (locale) => {
      expect(
        await translateComponentLabels(
          locale,
          ['hero'],
          [{ type: 'hero', labelKey: 'componentPlatform.components.hero.label' }],
        ),
      ).toEqual({ hero: 'Hero' });
    },
  );
  it('preserves the type for an unknown catalog label', async () => {
    expect(
      await translateComponentLabels(
        'en',
        ['unknown'],
        [{ type: 'unknown', labelKey: 'componentPlatform.missing' }],
      ),
    ).toEqual({ unknown: 'unknown' });
  });
});
