import type { RootState } from "@/store/store";
import { createSelector } from "@reduxjs/toolkit";
import { findNode, getAncestorPath } from "@/modules/builder/domain/tree-operations";

export const selectDraftChildren = (state: RootState) => state.document.history.present.children;
export const selectSelectedNodeId = (state: RootState) => state.document.history.present.selectedNodeId;
export const selectHoveredNodeId = (state: RootState) => state.ui.hoveredNodeId;
export const selectIsDirty = (state: RootState) => state.saveState.isDirty;
export const selectSaveStatus = (state: RootState) => state.saveState.saveStatus;
export const selectSaveError = (state: RootState) => state.saveState.saveError;
export const selectBuilderMode = (state: RootState) => state.ui.mode;
export const selectViewport = (state: RootState) => state.ui.viewport;
export const selectBuilderPageId = (state: RootState) => state.document.pageId;
export const selectEditorMode = (state: RootState) => state.ui.editorMode;

export const selectCanUndo = (state: RootState) => state.document.history.past.length > 0;
export const selectCanRedo = (state: RootState) => state.document.history.future.length > 0;

// Module-level constant so the "nothing selected" case doesn't allocate a new
// array/identity on every call — createSelector's default equality check is
// reference equality, so a fresh [] each time still counts as "changed".
const EMPTY_ANCESTORS: ReturnType<typeof getAncestorPath> = [];

export const selectSelectedNode = createSelector(
    [selectDraftChildren, selectSelectedNodeId],
    (children, id) => {
        if (!id) return null;
        return findNode(children, id);
    }
);

/** Ancestor chain for the currently selected node, for the breadcrumb (spec §37). */
export const selectSelectedNodeAncestors = createSelector(
    [selectDraftChildren, selectSelectedNodeId],
    (children, id) => {
        if (!id) return EMPTY_ANCESTORS;
        return getAncestorPath(children, id);
    }
);
