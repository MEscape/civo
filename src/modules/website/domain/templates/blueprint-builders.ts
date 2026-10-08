import type { BlueprintNode } from '../models/website-template';

export type SectionTone = 'default' | 'muted';

/**
 * Seed content written into every new website's home page. It is data the
 * municipality edits afterwards, not UI text, so it is not translated.
 */
export const HOME_PAGE_TITLE = 'Startseite';

export function component(
  type: string,
  key: string,
  props?: Readonly<Record<string, unknown>>,
): BlueprintNode {
  return props ? { key, type, props } : { key, type };
}

export function section(
  key: string,
  tone: SectionTone,
  children: readonly BlueprintNode[],
): BlueprintNode {
  return { key, type: 'section', props: { tone }, children };
}
