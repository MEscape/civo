import { createSlice, type PayloadAction, isAnyOf } from "@reduxjs/toolkit";
import {
    loadPage,
    insertNodeAction,
    removeNodeAction,
    duplicateNodeAction,
    moveNodeAction,
    updateNodePropsAction,
    undo,
    redo,
} from "./document-slice";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type SaveState = {
    isDirty: boolean;
    saveStatus: SaveStatus;
    saveError: string | null;
};

const initialState: SaveState = {
    isDirty: false,
    saveStatus: "idle",
    saveError: null,
};

const saveStateSlice = createSlice({
    name: "saveState",
    initialState,
    reducers: {
        saveStarted(state) {
            state.saveStatus = "saving";
            state.saveError = null;
        },
        saveSucceeded(state) {
            state.isDirty = false;
            state.saveStatus = "saved";
            state.saveError = null;
        },
        saveFailed(state, action: PayloadAction<string>) {
            state.saveStatus = "error";
            state.saveError = action.payload;
        },
    },
    extraReducers: (builder) => {
        // Reset when loading a new page
        builder.addCase(loadPage, (state) => {
            state.isDirty = false;
            state.saveStatus = "idle";
            state.saveError = null;
        });

        // Any document mutation marks the state as dirty
        builder.addMatcher(
            isAnyOf(
                insertNodeAction,
                removeNodeAction,
                duplicateNodeAction,
                moveNodeAction,
                updateNodePropsAction,
                undo,
                redo
            ),
            (state) => {
                state.isDirty = true;
            }
        );
    },
});

export const { saveStarted, saveSucceeded, saveFailed } = saveStateSlice.actions;
export default saveStateSlice.reducer;
