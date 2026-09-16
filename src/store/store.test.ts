import { describe, expect, it } from "vitest";
import { store } from "./store";

describe("Redux store", () => {
    it("creates the store", () => {
        expect(store).toBeDefined();
    });

    it("contains the expected state slices", () => {
        const state = store.getState();

        expect(state).toHaveProperty("document");
        expect(state).toHaveProperty("ui");
        expect(state).toHaveProperty("saveState");
    });

    it("does not contain unexpected state slices", () => {
        expect(Object.keys(store.getState())).toEqual([
            "document",
            "ui",
            "saveState",
        ]);
    });

    it("initializes all state slices", () => {
        const state = store.getState();

        expect(state.document).toBeDefined();
        expect(state.ui).toBeDefined();
        expect(state.saveState).toBeDefined();
    });
});
