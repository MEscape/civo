import { fieldPath } from '@lib/errors';
import type { FieldErrorBag } from '@lib/errors';
import { isJsonRecord, isPlainObject, jsonWeight } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

import { BUILDER_VALIDATION_CODES as CODES } from '../errors/builder-errors';

import { isValidNodeId, toPageNodeId } from './ids';

import type { PageNodeId } from './ids';

/**
 * Bounds for untrusted trees (security.md: bound externally reachable
 * input). They protect the renderer and the database, not business rules.
 * `maxContentLength` approximates serialized size by counting characters
 * (`jsonWeight`), so nothing has to be serialized to be measured.
 *
 * `maxDepth` is a number of levels. Depth is zero-based everywhere in the
 * domain (root nodes sit at depth 0), so use `isWithinDepthLimit` instead
 * of comparing against it by hand.
 */
export const PAGE_TREE_LIMITS = {
  maxNodes: 500,
  maxDepth: 12,
  maxPropsDepth: 8,
  typeMaxLength: 64,
  maxContentLength: 1_000_000,
} as const;

export const NODE_TYPE_PATTERN = /^[A-Za-z][A-Za-z0-9._-]*$/;

/** True when a tree of `nodeCount` nodes is within bounds. */
export function isWithinNodeLimit(nodeCount: number): boolean {
  return nodeCount <= PAGE_TREE_LIMITS.maxNodes;
}

/** True when a node at zero-based `depth` is within bounds. */
export function isWithinDepthLimit(depth: number): boolean {
  return depth < PAGE_TREE_LIMITS.maxDepth;
}

export type PageNodeProps = Readonly<Record<string, JsonValue>>;

/** A prop edit: `undefined` removes the key (clearing a field), anything else sets it. */
export type PageNodePropsPatch = Readonly<Record<string, JsonValue | undefined>>;

/**
 * One node of a page. `type` names a component in the catalog; whether the
 * type is registered is checked when a page is saved (`checkComposition`),
 * not here, so a renamed component never makes every stored page unreadable.
 */
export interface PageNode {
  readonly id: PageNodeId;
  readonly type: string;
  readonly props: PageNodeProps;
  /** Always present; a leaf has an empty array. */
  readonly children: readonly PageNode[];
}

/**
 * One parse of one forest. The counters live on the instance, so the
 * recursion shares them without threading a mutable argument through
 * every function, and a parser is never reused across inputs.
 */
class NodeForestParser {
  private readonly seenIds = new Set<string>();
  private nodeCount = 0;
  private contentLength = 0;
  private hasReportedNodeLimit = false;
  private hasReportedSizeLimit = false;

  constructor(private readonly bag: FieldErrorBag) {}

  parseChildren(raw: unknown, path: string, depth: number): readonly PageNode[] {
    if (!Array.isArray(raw)) {
      this.bag.add(path, CODES.configInvalid);
      return [];
    }
    return raw.flatMap((item: unknown, index: number) => {
      const node = this.parseNode(item, fieldPath(path, index), depth);
      return node === null ? [] : [node];
    });
  }

  private parseNode(raw: unknown, path: string, depth: number): PageNode | null {
    if (!isPlainObject(raw)) {
      this.bag.add(path, CODES.nodeInvalid);
      return null;
    }
    if (!isWithinDepthLimit(depth)) {
      this.bag.add(path, CODES.depthLimitExceeded);
      return null;
    }
    this.nodeCount += 1;
    if (!isWithinNodeLimit(this.nodeCount)) {
      this.reportNodeLimitOnce(path);
      return null;
    }

    const id = this.parseId(raw['id'], fieldPath(path, 'id'));
    const type = this.parseType(raw['type'], fieldPath(path, 'type'));
    const props = this.parseProps(raw['props'], fieldPath(path, 'props'));
    // Children are parsed even when this node is invalid, so one pass reports every error.
    const children =
      raw['children'] === undefined
        ? []
        : this.parseChildren(raw['children'], fieldPath(path, 'children'), depth + 1);

    if (id === null || type === null || props === null) {
      return null;
    }
    return { id, type, props, children };
  }

  private reportNodeLimitOnce(path: string): void {
    if (this.hasReportedNodeLimit) {
      return;
    }
    this.hasReportedNodeLimit = true;
    this.bag.add(path, CODES.nodeLimitExceeded);
  }

  private parseId(value: unknown, path: string): PageNodeId | null {
    if (typeof value !== 'string' || !isValidNodeId(value)) {
      this.bag.add(path, CODES.nodeIdInvalid);
      return null;
    }
    if (this.seenIds.has(value)) {
      this.bag.add(path, CODES.nodeIdDuplicate);
      return null;
    }
    this.seenIds.add(value);
    return toPageNodeId(value);
  }

  private parseType(value: unknown, path: string): string | null {
    if (
      typeof value !== 'string' ||
      value.length > PAGE_TREE_LIMITS.typeMaxLength ||
      !NODE_TYPE_PATTERN.test(value)
    ) {
      this.bag.add(path, CODES.nodeTypeInvalid);
      return null;
    }
    return value;
  }

  private parseProps(value: unknown, path: string): PageNodeProps | null {
    if (!isJsonRecord(value, PAGE_TREE_LIMITS.maxPropsDepth)) {
      this.bag.add(path, CODES.nodePropsInvalid);
      return null;
    }
    this.contentLength += jsonWeight(value);
    if (this.contentLength > PAGE_TREE_LIMITS.maxContentLength && !this.hasReportedSizeLimit) {
      this.hasReportedSizeLimit = true;
      this.bag.add(path, CODES.configTooLarge);
    }
    return value;
  }
}

/**
 * Parses an untrusted forest of nodes, reporting every invalid field into
 * `bag` under `path`. Ids must be unique across the whole forest.
 */
export function parseNodeForest(
  raw: unknown,
  path: string,
  bag: FieldErrorBag,
): readonly PageNode[] {
  return new NodeForestParser(bag).parseChildren(raw, path, 0);
}
