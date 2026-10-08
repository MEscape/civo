import { fieldPath } from '@lib/errors';
import type { ForbiddenAppError, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { changedKeys, isDefined, keyBy } from '@lib/utils';

import {
  BUILDER_VALIDATION_CODES as CODES,
  createBuilderErrorBag,
  propChangeNotPermitted,
  structureChangeNotPermitted,
} from '../errors/builder-errors';
import { VISIBILITY_PROP_KEY, hasCapability } from '../models/editor-capabilities';
import { flattenNodes } from '../tree/tree-operations';

import type { ComponentCatalog } from '../models/component-catalog';
import type { EditorMode } from '../models/editor-capabilities';
import type { PageConfig } from '../models/page-config';
import type { PageNode } from '../models/page-node';
import type { FlatNode } from '../tree/tree-operations';

/*
 * What a SAVE may contain. The client UI hides what an editor may not do,
 * but UI visibility is not authorization (security.md): these checks run on
 * the server, on the config the client actually sent.
 */

/**
 * A page saved through the builder may only contain registered components
 * nested the way the catalog allows. Reports every violation.
 */
export function checkComposition(
  config: PageConfig,
  catalog: ComponentCatalog,
): AppResult<void, ValidationAppError> {
  const bag = createBuilderErrorBag();

  function visit(nodes: readonly PageNode[], parentType: string | null, path: string): void {
    // Under an unregistered parent, nesting errors would only echo the real problem.
    const isParentKnown = parentType === null || catalog.isRegistered(parentType);
    for (const [index, node] of nodes.entries()) {
      const nodePath = fieldPath(path, index);
      if (!catalog.isRegistered(node.type)) {
        bag.add(fieldPath(nodePath, 'type'), CODES.nodeTypeUnknown);
      } else if (isParentKnown && !catalog.canNest(parentType, node.type)) {
        bag.add(nodePath, CODES.nestingNotAllowed);
      }
      visit(node.children, node.type, fieldPath(nodePath, 'children'));
    }
  }

  visit(config.children, null, 'children');
  return bag.hasErrors ? err(bag.toError()) : ok(undefined);
}

function hasSameStructure(before: readonly FlatNode[], after: readonly FlatNode[]): boolean {
  return (
    before.length === after.length &&
    before.every((entry, index) => {
      const other = after[index];
      return (
        isDefined(other) &&
        other.node.id === entry.node.id &&
        other.node.type === entry.node.type &&
        other.parentId === entry.parentId
      );
    })
  );
}

/**
 * Compares the stored page with the submitted one against what `mode` may
 * change: without `editStructure` the tree shape (ids, types, nesting,
 * order) must be identical, and in restricted modes only the props the
 * catalog lists (plus the visibility toggle) may differ.
 */
export function checkEditScope({
  previous,
  next,
  mode,
  catalog,
}: {
  readonly previous: PageConfig;
  readonly next: PageConfig;
  readonly mode: EditorMode;
  readonly catalog: ComponentCatalog;
}): AppResult<void, ForbiddenAppError> {
  const before = flattenNodes(previous.children);
  const after = flattenNodes(next.children);

  if (!hasCapability(mode, 'editStructure') && !hasSameStructure(before, after)) {
    return err(structureChangeNotPermitted());
  }

  const previousById = keyBy(before, (entry) => entry.node.id);
  const canToggleVisibility = hasCapability(mode, 'toggleVisibility');

  for (const { node } of after) {
    const old = previousById.get(node.id);
    if (old === undefined) {
      continue;
    } // new nodes exist only with `editStructure`, checked above

    const allowed = catalog.editablePropKeys(node.type, mode);
    if (allowed === null) {
      continue;
    }

    const isForbidden = changedKeys(old.node.props, node.props).some(
      (key) => !allowed.has(key) && !(canToggleVisibility && key === VISIBILITY_PROP_KEY),
    );
    if (isForbidden) {
      return err(propChangeNotPermitted());
    }
  }
  return ok(undefined);
}
