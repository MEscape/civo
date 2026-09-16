import { configureStore } from "@reduxjs/toolkit";
import documentReducer from "@/modules/builder/application/document-slice";
import uiReducer from "@/modules/builder/application/ui-slice";
import saveStateReducer from "@/modules/builder/application/save-state-slice";

/**
 * The Redux store holds ONLY client-side builder/editor state.
 * Server data (websites, pages, content) is never mirrored into Redux — 
 * Server Components fetch it directly, and Server Actions mutate it directly. 
 * Redux Toolkit is used here because the builder genuinely needs cross-component 
 * client state (selection, drag state, undo/redo-ready draft tree), not because
 * Redux is available.
 */
export const store = configureStore({
    reducer: {
        document: documentReducer,
        ui: uiReducer,
        saveState: saveStateReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
