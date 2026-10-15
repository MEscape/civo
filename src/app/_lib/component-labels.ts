import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

/**
 * The names people know components by, in the page's language. A component
 * the catalog has no name for is shown by its type, so a list never has a hole.
 */
export async function loadComponentLabels(
  locale: Locale,
  types: readonly string[],
): Promise<Readonly<Record<string, string>>> {
  const t = await getTranslations({ locale, namespace: 'componentPlatform' });

  return Object.fromEntries(
    types.map((type) => {
      // The key depends on the type, which the typed catalog cannot know in advance.
      const key = `components.${type}.label` as never;
      return [type, t.has(key) ? t(key) : type] as const;
    }),
  );
}
