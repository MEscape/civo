import { describe, it, expect } from "vitest";
import reducer, {
    saveStarted,
    saveSucceeded,
    saveFailed,
    type SaveState,
} from "@/modules/builder/application/save-state-slice";
import {
    loadPage,
    insertNodeAction,
    removeNodeAction,
    updateNodePropsAction,
    undo,
} from "@/modules/builder/application/document-slice";

const initialState: SaveState = {
    isDirty: false,
    saveStatus: "idle",
    saveError: null,
};

describe("save-state slice", () => {
    it("should return the initial state", () => {
        expect(reducer(undefined, { type: "unknown" })).toEqual(initialState);
    });

    it("should handle saveStarted", () => {
        const actual = reducer(initialState, saveStarted());
        expect(actual.saveStatus).toBe("saving");
        expect(actual.saveError).toBeNull();
    });

    it("should handle saveSucceeded", () => {
        const dirtyState: SaveState = { isDirty: true, saveStatus: "saving", saveError: "Previous Error" };
        const actual = reducer(dirtyState, saveSucceeded());
        expect(actual.isDirty).toBe(false);
        expect(actual.saveStatus).toBe("saved");
        expect(actual.saveError).toBeNull();
    });

    it("should handle saveFailed", () => {
        const dirtyState: SaveState = { isDirty: true, saveStatus: "saving", saveError: null };
        const actual = reducer(dirtyState, saveFailed("Network Error"));
        expect(actual.isDirty).toBe(true);
        expect(actual.saveStatus).toBe("error");
        expect(actual.saveError).toBe("Network Error");
    });

    it("should reset state on loadPage", () => {
        const dirtyState: SaveState = { isDirty: true, saveStatus: "error", saveError: "Network Error" };
        const actual = reducer(dirtyState, loadPage({ pageId: "page-1", children: [] }));
        expect(actual.isDirty).toBe(false);
        expect(actual.saveStatus).toBe("idle");
        expect(actual.saveError).toBeNull();
    });

    describe("document modification matchers", () => {
        it("should set isDirty = true when insertNodeAction is dispatched", () => {
            const action = insertNodeAction({ node: { id: "n1", type: "hero", props: {} }, parentId: null });
            const actual = reducer(initialState, action);
            expect(actual.isDirty).toBe(true);
        });

        it("should set isDirty = true when removeNodeAction is dispatched", () => {
            const actual = reducer(initialState, removeNodeAction("node-1"));
            expect(actual.isDirty).toBe(true);
        });

        it("should set isDirty = true when updateNodePropsAction is dispatched", () => {
            const actual = reducer(initialState, updateNodePropsAction({ nodeId: "node-1", props: {} }));
            expect(actual.isDirty).toBe(true);
        });

        it("should set isDirty = true when undo is dispatched", () => {
            const actual = reducer(initialState, undo());
            expect(actual.isDirty).toBe(true);
        });
    });
});
