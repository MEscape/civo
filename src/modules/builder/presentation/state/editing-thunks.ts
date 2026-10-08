import { BUILDER_ERROR_CODES } from '../../application/contracts/builder-constraints';
import {
  APPEND_INDEX,
  duplicateNode,
  findNode,
  insertNewComponent,
  locateNode,
  moveNode,
  nextSelectionAfterRemoval,
  removeNode,
  resolvePlacement,
} from '../../application/contracts/editor-model';

import { noticeRaised } from './builder-actions';
import { commit } from './node-edit-commit';

import type { BuilderThunk } from './builder-thunk';
import type {
  ActiveDrag,
  ComponentCatalog,
  DropTarget,
  InsertedComponent,
  PageNode,
  PageNodeId,
  Placement,
} from '../../application/contracts/editor-model';

/**
 * Click-to-add goes to the page root when the component may live there,
 * else into the selected container, else nowhere.
 */
function toSnapshot(inserted: InsertedComponent) {
  return { children: inserted.tree, selectedNodeId: inserted.newNodeId };
}

function resolveAppendPlacement({
  children,
  selectedId,
  componentType,
  catalog,
}: {
  readonly children: readonly PageNode[];
  readonly selectedId: PageNodeId | null;
  readonly componentType: string;
  readonly catalog: ComponentCatalog;
}): Placement | null {
  if (catalog.canNest(null, componentType)) {
    return { parentId: null, index: APPEND_INDEX };
  }
  const selected = selectedId === null ? null : findNode(children, selectedId);
  return selected !== null && catalog.canNest(selected.type, componentType)
    ? { parentId: selected.id, index: APPEND_INDEX }
    : null;
}

export function insertComponent(componentType: string): BuilderThunk {
  return (dispatch, getState, { catalog, createIdSeed }) => {
    const { children, selectedNodeId } = getState().document.history.present;
    const placement = resolveAppendPlacement({
      children,
      selectedId: selectedNodeId,
      componentType,
      catalog,
    });
    if (placement === null) {
      dispatch(noticeRaised(BUILDER_ERROR_CODES.placementRejected));
      return;
    }
    dispatch(
      commit(
        insertNewComponent({
          nodes: children,
          catalog,
          componentType,
          placement,
          idSeed: createIdSeed(),
        }).map(toSnapshot),
      ),
    );
  };
}

export function removeNodeById(nodeId: PageNodeId): BuilderThunk {
  return (dispatch, getState) => {
    const { children, selectedNodeId } = getState().document.history.present;
    dispatch(
      commit(
        removeNode(children, nodeId).map((tree) => ({
          children: tree,
          selectedNodeId: nextSelectionAfterRemoval(children, nodeId, selectedNodeId),
        })),
      ),
    );
  };
}

export function removeSelectedNode(): BuilderThunk {
  return (dispatch, getState) => {
    const { selectedNodeId } = getState().document.history.present;
    if (selectedNodeId !== null) {
      dispatch(removeNodeById(selectedNodeId));
    }
  };
}

export function duplicateNodeById(nodeId: PageNodeId): BuilderThunk {
  return (dispatch, getState, { createIdSeed }) => {
    const { children } = getState().document.history.present;
    dispatch(
      commit(
        duplicateNode(children, nodeId, createIdSeed()).map(({ tree, newNodeId }) => ({
          children: tree,
          selectedNodeId: newNodeId,
        })),
      ),
    );
  };
}

/** Moves a node one step among its siblings; a no-op at the ends. */
export function moveNodeBy(nodeId: PageNodeId, direction: -1 | 1): BuilderThunk {
  return (dispatch, getState, { catalog }) => {
    const { children, selectedNodeId } = getState().document.history.present;
    const location = locateNode(children, nodeId);
    if (location === null) {
      return;
    }

    const index = location.index + direction;
    if (index < 0 || index >= location.siblings.length) {
      return;
    }
    dispatch(
      commit(
        moveNode(
          children,
          { nodeId, placement: { parentId: location.parentId, index } },
          catalog,
        ).map((tree) => ({ children: tree, selectedNodeId })),
      ),
    );
  };
}

/** Applies a finished drag: inserts a palette component or moves an existing node. */
export function applyDrop(source: ActiveDrag, target: DropTarget): BuilderThunk {
  return (dispatch, getState, { catalog, createIdSeed }) => {
    const { children } = getState().document.history.present;

    const placement = resolvePlacement(children, source.id, target);
    if (source.id !== null) {
      const movedId = source.id;
      dispatch(
        commit(
          placement.andThen((resolved) =>
            moveNode(children, { nodeId: movedId, placement: resolved }, catalog).map((tree) => ({
              children: tree,
              selectedNodeId: movedId,
            })),
          ),
        ),
      );
      return;
    }

    dispatch(
      commit(
        placement.andThen((resolved) =>
          insertNewComponent({
            nodes: children,
            catalog,
            componentType: source.type,
            placement: resolved,
            idSeed: createIdSeed(),
          }).map(toSnapshot),
        ),
      ),
    );
  };
}
