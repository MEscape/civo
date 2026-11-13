import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

/** Resolve the catalog's fully qualified vocabulary within its owning namespace. */
export async function translateComponentLabels(
  locale: Locale,
  types: readonly string[],
  catalog: ReadonlyArray<{ readonly type: string; readonly labelKey: string }>,
): Promise<Readonly<Record<string, string>>> {
  const t = await getTranslations({ locale, namespace: 'componentPlatform' });
  return Object.fromEntries(
    catalog
      .filter((entry) => types.includes(entry.type))
      .map((entry) => {
        const key = entry.labelKey.replace(/^componentPlatform\./, '') as Parameters<typeof t>[0];
        return [entry.type, t.has(key) ? t(key) : entry.type];
      }),
  );
}
