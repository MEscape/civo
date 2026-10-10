import { getContentDefinition } from './content-definitions';

import type { ContentKind, ContentOf } from './content-definitions';

/** Any valid instant works: a sample's categories never depend on the date. */
const SAMPLE_REFERENCE_INSTANT = '2000-01-01T00:00:00.000Z';

/**
 * The distinct, non-blank category values of `records`, in a stable order,
 * as the kind's own `categoryOf` rule reads them. A kind without a category
 * has none.
 */
export function categoriesOf<K extends ContentKind>(
  kind: K,
  records: ReadonlyArray<ContentOf<K>>,
): readonly string[] {
  const { categoryOf } = getContentDefinition(kind).rule;
  if (categoryOf === undefined) {
    return [];
  }
  const found = new Set<string>();
  for (const record of records) {
    const category = categoryOf(record)?.trim();
    if (category !== undefined && category !== '') {
      found.add(category);
    }
  }
  return [...found].sort((first, second) => first.localeCompare(second));
}

/** The categories of the placeholder records a draft shows while nothing is bound. */
export function sampleCategoriesOf(kind: ContentKind): readonly string[] {
  return categoriesOf(kind, getContentDefinition(kind).sample(SAMPLE_REFERENCE_INSTANT));
}
