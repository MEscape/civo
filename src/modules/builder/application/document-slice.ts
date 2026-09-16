import { createSlice, type PayloadAction, current } from "@reduxjs/toolkit";
import type { PageNode } from "@/modules/builder/domain/page-node";
import {
    insertNode,
    removeNode as removeNodeFromTree,
    updateNodeProps as updateNodePropsInTree,
    duplicateNode as duplicateNodeInTree,
    moveNode as moveNodeInTree,
} from "@/modules/builder/domain/tree-operations";

type HistoryEntry = {
    children: PageNode[];
    selectedNodeId: string | null;
};

export type DocumentState = {
    pageId: string | null;
    history: {
        past: HistoryEntry[];
        present: HistoryEntry;
        future: HistoryEntry[];
        isEditingProps: boolean;
    };
};

const MAX_HISTORY = 100;
const emptyEntry: HistoryEntry = { children: [], selectedNodeId: null };

const initialState: DocumentState = {
    pageId: null,
    history: { past: [], present: emptyEntry, future: [], isEditingProps: false },
};

function pushHistory(state: DocumentState, next: HistoryEntry) {
    state.history.past.push(state.history.present);
    if (state.history.past.length > MAX_HISTORY) {
        state.history.past.shift();
    }
    state.history.present = next;
    state.history.future = [];
    state.history.isEditingProps = false;
}

const documentSlice = createSlice({
    name: "document",
    initialState,
    reducers: {
        loadPage(state, action: PayloadAction<{ pageId: string; children: PageNode[] }>) {
            state.pageId = action.payload.pageId;
            state.history = {
                past: [],
                present: { children: action.payload.children, selectedNodeId: null },
                future: [],
                isEditingProps: false,
            };
        },
        selectNode(state, action: PayloadAction<string | null>) {
            state.history.present.selectedNodeId = action.payload;
        },
        insertNodeAction(
            state,
            action: PayloadAction<{ node: PageNode; parentId: string | null; index?: number }>
        ) {
            const { node, parentId, index } = action.payload;
            const children = insertNode(state.history.present.children, node, { parentId, index });
            pushHistory(state, { children, selectedNodeId: node.id });
        },
        removeNodeAction(state, action: PayloadAction<string>) {
            const children = removeNodeFromTree(state.history.present.children, action.payload);
            const selectedNodeId =
                state.history.present.selectedNodeId === action.payload
                    ? null
                    : state.history.present.selectedNodeId;
            pushHistory(state, { children, selectedNodeId });
        },
        duplicateNodeAction(state, action: PayloadAction<string>) {
            const result = duplicateNodeInTree(state.history.present.children, action.payload);
            if (!result) return;
            pushHistory(state, { children: result.tree, selectedNodeId: result.newNodeId });
        },
        moveNodeAction(
            state,
            action: PayloadAction<{ nodeId: string; parentId: string | null; index?: number }>
        ) {
            const { nodeId, parentId, index } = action.payload;
            const children = moveNodeInTree(state.history.present.children, nodeId, { parentId, index });
            pushHistory(state, { children, selectedNodeId: state.history.present.selectedNodeId });
        },
        updateNodePropsAction(
            state,
            action: PayloadAction<{ nodeId: string; props: Record<string, unknown> }>
        ) {
            if (!state.history.isEditingProps) {
                state.history.past.push(current(state.history.present));
                if (state.history.past.length > MAX_HISTORY) {
                    state.history.past.shift();
                }
                state.history.future = [];
                state.history.isEditingProps = true;
            }
            state.history.present.children = updateNodePropsInTree(
                state.history.present.children,
                action.payload.nodeId,
                action.payload.props
            );
        },
        commitPropsHistory(state) {
            state.history.isEditingProps = false;
        },
        undo(state) {
            const previous = state.history.past.pop();
            if (!previous) return;
            state.history.future.unshift(state.history.present);
            state.history.present = previous;
            state.history.isEditingProps = false;
        },
        redo(state) {
            const next = state.history.future.shift();
            if (!next) return;
            state.history.past.push(state.history.present);
            state.history.present = next;
            state.history.isEditingProps = false;
        },
    },
});

export const {
    loadPage,
    selectNode,
    insertNodeAction,
    removeNodeAction,
    duplicateNodeAction,
    moveNodeAction,
    updateNodePropsAction,
    commitPropsHistory,
    undo,
    redo,
} = documentSlice.actions;

export default documentSlice.reducer;
