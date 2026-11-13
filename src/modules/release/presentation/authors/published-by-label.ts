import type { ReleaseTranslator } from '../translation/translator';

/**
 * Who published a release, as a phrase: by name, or by a former member when the id has no name any
 * more. `null` when nobody is recorded or the names could not be read at all, so a screen never
 * claims a person left merely because the lookup failed.
 */
export function publishedByLabel(
  t: ReleaseTranslator,
  publishedBy: string | null,
  authors: Readonly<Record<string, string>> | null,
): string | null {
  if (publishedBy === null || authors === null) {
    return null;
  }
  const name = authors[publishedBy];
  return name === undefined ? t('history.publishedByFormer') : t('history.publishedBy', { name });
}
