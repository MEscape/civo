import type { ComponentCatalog } from './component-catalog';
import type { PageConfig } from './page-config';

/** How a block is sketched: a layout shows its columns, text shows lines, anything else is a widget. */
export type OutlineShape = 'layout' | 'text' | 'widget';

export interface OutlineBlock {
  readonly shape: OutlineShape;
  /** Columns a layout splits into; 1 for everything else. */
  readonly columns: number;
}

/** A thumbnail is a few pixels high: more blocks than this would be noise. */
export const MAX_OUTLINE_BLOCKS = 5;
const MAX_OUTLINE_COLUMNS = 4;

/**
 * The page's top-level blocks as a sketch for the page list: cheap, drawn
 * from the stored tree alone, with no component rendered. A type the catalog
 * no longer knows is sketched as a widget.
 */
export function outlineOf(config: PageConfig, catalog: ComponentCatalog): readonly OutlineBlock[] {
  return config.children.slice(0, MAX_OUTLINE_BLOCKS).map((node) => {
    const category = catalog.describe(node.type)?.category;
    if (category === 'layout') {
      const columns = Math.min(Math.max(node.children.length, 1), MAX_OUTLINE_COLUMNS);
      return { shape: 'layout', columns };
    }
    return { shape: category === 'content' ? 'text' : 'widget', columns: 1 };
  });
}
