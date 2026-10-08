/**
 * The pure editor kernel the client shares with the server: tree
 * operations, drop placement, undo history and the component catalog.
 * Presentation may not import the domain, and a second client copy of these
 * rules would drift, so they are re-exported here, exactly like
 * `builder-constraints.ts`. Everything is pure, deterministic and free of
 * React, the DOM and Redux.
 */
export {
  canRedo,
  canUndo,
  commitSnapshot,
  createHistory,
  finishPropsEdit,
  isDirty,
  markSaved,
  redoEdit,
  selectNodeInHistory,
  undoEdit,
  updatePropsInPlace,
} from '../../domain/history/document-history';
export type { DocumentHistory, EditorSnapshot } from '../../domain/history/document-history';
export { createComponentCatalog } from '../../domain/models/component-catalog';
export type { ComponentCatalog, NestingPolicy } from '../../domain/models/component-catalog';
export { hasCapability } from '../../domain/models/editor-capabilities';
export { parsePageNodeId } from '../../domain/models/ids';
export type { PageNodeId } from '../../domain/models/ids';
export type { PageConfig } from '../../domain/models/page-config';
export type { PageNode, PageNodeProps, PageNodePropsPatch } from '../../domain/models/page-node';
export {
  resolveDropTargetAtCanvasEnd,
  resolveDropTargetForNode,
  resolvePlacement,
  stepDropTarget,
} from '../../domain/tree/drop-placement';
export type {
  ActiveDrag,
  DropContext,
  DropPosition,
  DropTarget,
  Rect,
} from '../../domain/tree/drop-placement';
export {
  APPEND_INDEX,
  createNodeFromBlueprint,
  duplicateNode,
  findNode,
  flattenNodes,
  getAncestors,
  insertNewComponent,
  insertNode,
  locateNode,
  moveNode,
  nextSelectionAfterRemoval,
  removeNode,
  updateNodeProps,
} from '../../domain/tree/tree-operations';
export type {
  DuplicatedNode,
  InsertedComponent,
  FlatNode,
  NodeLocation,
  NodeOperationError,
  Placement,
} from '../../domain/tree/tree-operations';
