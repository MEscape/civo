import type { ComponentCatalog } from './component-catalog';
import type { PageConfig } from './page-config';
import type { PageNode } from './page-node';

/** One component of a page that shows an uploaded file. */
export interface MediaUse {
  readonly assetId: string;
  readonly nodeId: string;
  readonly type: string;
}

/**
 * Every component of the page that shows an uploaded file, found through the catalog: a `media`
 * field holds one file's id. A component the catalog no longer knows shows nothing.
 */
export function mediaUsesOf(config: PageConfig, catalog: ComponentCatalog): readonly MediaUse[] {
  const uses: MediaUse[] = [];
  const visit = (node: PageNode): void => {
    const ids = new Set<string>();
    for (const field of catalog.describe(node.type)?.fields ?? []) {
      const value = node.props[field.key];
      if (field.control === 'media' && typeof value === 'string' && value !== '') {
        ids.add(value);
      }
    }
    ids.forEach((assetId) => uses.push({ assetId, nodeId: node.id, type: node.type }));
    node.children.forEach(visit);
  };
  config.children.forEach(visit);
  return uses;
}
