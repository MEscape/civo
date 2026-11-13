import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { getComponentPlatformQueries } from '@modules/component-platform';
import de from '@modules/component-platform/presentation/i18n/de.json';
import en from '@modules/component-platform/presentation/i18n/en.json';

/** Catalog-driven keys bypass literal-key type checks; verify them against both real catalogs. */
describe('component catalog translations', () => {
  for (const [locale, messages] of [
    ['en', en],
    ['de', de],
  ] as const) {
    it(`${locale} names every component and editable field, option and item`, () => {
      const t = createTranslator({ locale, messages });
      const catalog = getComponentPlatformQueries().listComponentCatalog.execute()._unsafeUnwrap();
      const missing = catalog.components
        .flatMap((component) => [
          component.labelKey,
          component.descriptionKey,
          ...component.fields.flatMap((field) => [
            field.labelKey,
            ...(field.placeholderKey === null ? [] : [field.placeholderKey]),
            ...field.options.flatMap((option) =>
              option.labelKey === null ? [] : [option.labelKey],
            ),
            ...field.itemFields.map((item) => item.labelKey),
          ]),
        ])
        .filter((key) => !t.has(key as Parameters<typeof t.has>[0]));
      expect(missing).toEqual([]);
    });
  }
});
