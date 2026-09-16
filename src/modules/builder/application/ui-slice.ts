import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { loadPage } from "./document-slice";

export type BuilderMode = "select" | "preview";
export type Viewport = "desktop" | "tablet" | "mobile";

export type UiState = {
    hoveredNodeId: string | null;
    mode: BuilderMode;
    viewport: Viewport;
};

const initialState: UiState = {
    hoveredNodeId: null,
    mode: "select",
    viewport: "desktop",
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
    },
    extraReducers: (builder) => {
        // Reset hover state when loading a new page
        builder.addCase(loadPage, (state) => {
            state.hoveredNodeId = null;
        });
    },
});

export const { hoverNode, setMode, setViewport } = uiSlice.actions;
export default uiSlice.reducer;
