import type { FieldErrorBag, UnexpectedAppError, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { isPlainObject } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

import {
  BUILDER_VALIDATION_CODES as CODES,
  createBuilderErrorBag,
  pageConfigCorrupted,
} from '../errors/builder-errors';

import { parseNodeForest } from './page-node';

import type { PageNode } from './page-node';

/** The root of a page: always a single `page` holding a forest of nodes. */
export interface PageConfig {
  readonly type: 'page';
  readonly children: readonly PageNode[];
}

/** A config as plain JSON: what storage and snapshots hold. */
export type PageConfigJson = Readonly<Record<string, JsonValue>>;

export const EMPTY_PAGE_CONFIG: PageConfig = { type: 'page', children: [] };

/**
 * Builds a config from untrusted children, reporting into a caller-owned
 * bag so a draft can collect page-field and tree errors in one pass.
 * Returns `null` once the bag holds any error.
 */
export function readPageConfig(
  rawChildren: unknown,
  path: string,
  bag: FieldErrorBag,
): PageConfig | null {
  const children = parseNodeForest(rawChildren, path, bag);
  return bag.hasErrors ? null : { type: 'page', children };
}

/** The only way a config from a request enters the system. */
export function parsePageConfig(input: unknown): AppResult<PageConfig, ValidationAppError> {
  const bag = createBuilderErrorBag();
  if (!isPlainObject(input) || input['type'] !== 'page') {
    bag.add('type', CODES.configInvalid);
    return err(bag.toError());
  }
  const config = readPageConfig(input['children'], 'children', bag);
  return config === null ? err(bag.toError()) : ok(config);
}

/**
 * Reads stored JSON. Same invariants as `parsePageConfig`, but a failure is
 * a data bug rather than bad input, so it surfaces as `unexpected` with the
 * validation failure preserved as the cause.
 */
export function restorePageConfig(stored: unknown): AppResult<PageConfig, UnexpectedAppError> {
  return parsePageConfig(stored).mapErr(pageConfigCorrupted);
}

function serializeNode(node: PageNode): JsonValue {
  return {
    id: node.id,
    type: node.type,
    props: { ...node.props },
    children: node.children.map(serializeNode),
  };
}

/**
 * The plain JSON form of a config. Interfaces are not assignable to JSON
 * index signatures, so the shape is built explicitly instead of cast. The
 * single definition of the stored format: persistence and snapshots both use it.
 */
export function serializePageConfig(config: PageConfig): PageConfigJson {
  return { type: config.type, children: config.children.map(serializeNode) };
}
