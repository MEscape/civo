import type { ComponentCatalog } from './component-catalog';
import type { PageConfig } from './page-config';
import type { PageNode } from './page-node';

/** One component of a page that reads a dataset. */
export interface DatasetUse {
  readonly datasetId: string;
  readonly nodeId: string;
  readonly type: string;
}

/**
 * Every component of the page that reads a dataset, found through the
 * catalog: a `dataset` field holds one id, a `datasets` field a list of them.
 * A component the catalog no longer knows reads nothing.
 */
export function datasetUsesOf(
  config: PageConfig,
  catalog: ComponentCatalog,
): readonly DatasetUse[] {
  const uses: DatasetUse[] = [];
  const visit = (node: PageNode): void => {
    const ids = new Set<string>();
    for (const field of catalog.describe(node.type)?.fields ?? []) {
      const value = node.props[field.key];
      if (field.control === 'dataset' && typeof value === 'string') {
        ids.add(value);
      } else if (field.control === 'datasets' && Array.isArray(value)) {
        value.forEach((entry) => typeof entry === 'string' && ids.add(entry));
      }
    }
    ids.forEach((datasetId) => uses.push({ datasetId, nodeId: node.id, type: node.type }));
    node.children.forEach(visit);
  };
  config.children.forEach(visit);
  return uses;
}

/** A component that reads a kind of data but has no dataset chosen yet, so it shows sample data. */
export interface ComponentAwaitingData {
  readonly nodeId: string;
  readonly type: string;
  /** The content kind its dataset field asks for. */
  readonly kind: string;
}

function isUnset(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && !value.some((entry) => typeof entry === 'string' && entry !== ''))
  );
}

/**
 * The page's components still waiting for data: a `dataset` or `datasets`
 * field with nothing chosen, once per kind asked for. A component reading two
 * kinds (news and events side by side) waits for each on its own, so it is
 * listed for each empty field, not only its first.
 */
export function componentsAwaitingDataOf(
  config: PageConfig,
  catalog: ComponentCatalog,
): readonly ComponentAwaitingData[] {
  const waiting: ComponentAwaitingData[] = [];
  const visit = (node: PageNode): void => {
    const kinds = new Set<string>();
    for (const field of catalog.describe(node.type)?.fields ?? []) {
      const readsData = field.control === 'dataset' || field.control === 'datasets';
      if (readsData && field.canonicalKind !== null && isUnset(node.props[field.key])) {
        kinds.add(field.canonicalKind);
      }
    }
    kinds.forEach((kind) => waiting.push({ nodeId: node.id, type: node.type, kind }));
    node.children.forEach(visit);
  };
  config.children.forEach(visit);
  return waiting;
}
