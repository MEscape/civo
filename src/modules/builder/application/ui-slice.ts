import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { loadPage } from "./document-slice";
import type { EditorMode } from "@/modules/builder/domain/editor-capabilities";

export type BuilderMode = "select" | "preview";
export type Viewport = "desktop" | "tablet" | "mobile";

export type UiState = {
    hoveredNodeId: string | null;
    mode: BuilderMode;
    viewport: Viewport;
    /**
     * Editor capability mode (spec §35). Set once when the builder
     * session starts (from the route that launched it — internal builder
     * vs municipality editor) and never changes during the session.
     */
    editorMode: EditorMode;
};

const initialState: UiState = {
    hoveredNodeId: null,
    mode: "select",
    viewport: "desktop",
    editorMode: "internal",
};

const uiSlice = createSlice({
    name: "ui",
    initialState,
    reducers: {
        hoverNode(state, action: PayloadAction<string | null>) {
            state.hoveredNodeId = action.payload;
        },
        setMode(state, action: PayloadAction<BuilderMode>) {
            state.mode = action.payload;
        },
        setViewport(state, action: PayloadAction<Viewport>) {
            state.viewport = action.payload;
        },
        setEditorMode(state, action: PayloadAction<EditorMode>) {
            state.editorMode = action.payload;
        },
    },
    extraReducers: (builder) => {
        // Reset hover state when loading a new page
        builder.addCase(loadPage, (state) => {
            state.hoveredNodeId = null;
        });
    },
});

export const { hoverNode, setMode, setViewport, setEditorMode } = uiSlice.actions;
export default uiSlice.reducer;
