import { createSelector } from '@reduxjs/toolkit';

import {
  canRedo,
  canUndo,
  findNode,
  getAncestors,
  isDirty,
} from '../../application/contracts/editor-model';

import type { BuilderRootState } from './builder-store';

export const selectChildren = (state: BuilderRootState) => state.document.history.present.children;
export const selectSelectedNodeId = (state: BuilderRootState) =>
  state.document.history.present.selectedNodeId;
export const selectPageId = (state: BuilderRootState) => state.document.pageId;

const selectHistory = (state: BuilderRootState) => state.document.history;

/**
 * Derived, not stored: undoing back to the saved tree is clean again.
 * Memoized on the history object, so the deep comparison runs once per
 * edit however many components subscribe.
 */
export const selectIsDirty = createSelector([selectHistory], isDirty);
export const selectCanUndo = createSelector([selectHistory], canUndo);
export const selectCanRedo = createSelector([selectHistory], canRedo);

export const selectSaveStatus = (state: BuilderRootState) => state.save.status;
export const selectSaveErrorCode = (state: BuilderRootState) => state.save.errorCode;

export const selectMode = (state: BuilderRootState) => state.ui.mode;
export const selectViewport = (state: BuilderRootState) => state.ui.viewport;
export const selectEditorMode = (state: BuilderRootState) => state.ui.editorMode;
export const selectNoticeCode = (state: BuilderRootState) => state.ui.noticeCode;

export const selectSelectedNode = createSelector(
  [selectChildren, selectSelectedNodeId],
  (children, id) => (id === null ? null : findNode(children, id)),
);

// A module-level constant keeps the "nothing selected" identity stable for reselect.
const NO_ANCESTORS: ReturnType<typeof getAncestors> = [];

export const selectSelectedAncestors = createSelector(
  [selectChildren, selectSelectedNodeId],
  (children, id) => (id === null ? NO_ANCESTORS : getAncestors(children, id)),
);
