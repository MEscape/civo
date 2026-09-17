"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loadPage, undo, redo, selectNode, removeNodeAction } from "@/modules/builder/application/document-slice";
import { selectIsDirty, selectSelectedNodeId, selectBuilderMode, selectViewport, selectDraftChildren, selectBuilderPageId } from "@/modules/builder/application/builder-selectors";
import type { PageNode } from "@/modules/builder/domain/page-node";
import { type EditorMode, hasCapability } from "@/modules/builder/domain/editor-capabilities";
import { setEditorMode } from "@/modules/builder/application/ui-slice";
import { ComponentPalette } from "@/modules/builder/components/component-palette";
import { BuilderCanvas } from "@/modules/builder/components/builder-canvas";
import { PropertiesPanel } from "@/modules/builder/components/properties-panel";
import { PreviewCanvas } from "@/modules/builder/components/preview-canvas";
import { useCanvasDnd } from "@/modules/builder/components/use-canvas-dnd";
import { useDropHandler } from "@/modules/builder/components/use-drop-handler";
import type { WebsiteTheme } from "@/modules/website/domain/theme";
import { BuilderToolbar } from "./builder-toolbar";
import { DragOverlayCursor } from "./drag-overlay-cursor";
import "@/modules/component-platform/infrastructure/definitions";

type BuilderShellProps = {
    website: { id: string; name: string; theme: WebsiteTheme };
    page: { id: string; title: string };
    initialChildren: PageNode[];
    /**
     * The editor capability mode for this session. Defaults to "internal".
     * Municipality-editor routes pass "municipality" here so the Redux
     * store is seeded correctly before any child component reads it.
     */
    editorMode?: EditorMode;
};

/**
 * The builder shell. Connects keyboard shortcuts, warning on unload,
 * and sets up the three-column layout wrapping the core canvas.
 */
export function BuilderShell({ website, page, initialChildren, editorMode = "internal" }: BuilderShellProps) {
    const dispatch = useAppDispatch();
    const draftChildren = useAppSelector(selectDraftChildren);
    const isDirty = useAppSelector(selectIsDirty);
    const selectedNodeId = useAppSelector(selectSelectedNodeId);
    const mode = useAppSelector(selectBuilderMode);
    const viewport = useAppSelector(selectViewport);

    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const handleDrop = useDropHandler(draftChildren, (id) => dispatch(selectNode(id)));
    const canEditStructure = hasCapability(editorMode, "editStructure");
    const dnd = useCanvasDnd(draftChildren, canvasContainerRef, handleDrop, canEditStructure);

    // Load this page's document into Redux whenever the page identity
    // changes. Reads the currently-loaded pageId from the store itself
    // (rather than a local ref mirroring the same fact) so there is one
    // source of truth, and dispatches from an effect rather than during
    // render — dispatching a store update while rendering is not safe
    // under React Compiler / concurrent rendering, since a render can be
    // retried or discarded and the dispatch must not fire more than once
    // for the same actual page load.
    const loadedPageId = useAppSelector(selectBuilderPageId);
    useEffect(() => {
        if (loadedPageId === page.id) return;
        dispatch(loadPage({ pageId: page.id, children: initialChildren }));
        // initialChildren intentionally excluded: this effect
        // must only re-run when the page identity itself changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, loadedPageId, page.id]);

    useEffect(() => {
        dispatch(setEditorMode(editorMode));
    }, [dispatch, editorMode]);

    // True for the single render between navigating to a new page and
    // this effect's dispatch(loadPage(...)) landing in the store. Used
    // below to avoid ever painting the PREVIOUS page's nodes under the
    // new page's toolbar/chrome — the flash the old ref-during-render
    // approach was written to avoid, without dispatching during render.
    const isSwitchingPage = loadedPageId !== page.id;

    // Warn on navigation away with unsaved changes
    useEffect(() => {
        function handleBeforeUnload(event: BeforeUnloadEvent) {
            if (!isDirty) return;
            event.preventDefault();
        }
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

    // Keyboard shortcuts
    useEffect(() => {
        function isEditableTarget(target: EventTarget | null): boolean {
            if (!(target instanceof HTMLElement)) return false;
            const tag = target.tagName;
            return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
        }

        function handleKeyDown(event: KeyboardEvent) {
            const meta = event.metaKey || event.ctrlKey;

            // The save shortcut (Cmd/Ctrl+S) is handled in BuilderToolbar,
            // which owns save state. This effect only handles shortcuts that
            // interact with document state directly: undo/redo/escape/delete.
            if (isEditableTarget(event.target)) return; // never hijack text editing

            if (meta && event.key.toLowerCase() === "z" && event.shiftKey) {
                event.preventDefault();
                dispatch(redo());
                return;
            }
            if (meta && event.key.toLowerCase() === "z") {
                event.preventDefault();
                dispatch(undo());
                return;
            }
            if (meta && event.key.toLowerCase() === "y") {
                event.preventDefault();
                dispatch(redo());
                return;
            }
            if (event.key === "Escape") {
                dispatch(selectNode(null));
                return;
            }
            if ((event.key === "Delete" || event.key === "Backspace") && selectedNodeId) {
                event.preventDefault();
                dispatch(removeNodeAction(selectedNodeId));
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [dispatch, selectedNodeId]);

    return (
        <div className="flex h-[calc(100vh-3.5rem)] flex-col">
            <BuilderToolbar website={website} page={page} />

            {mode === "preview" ? (
                <div className="flex-1 overflow-y-auto bg-[var(--civo-color-background)]">
                    <PreviewCanvas
                        nodes={isSwitchingPage ? [] : draftChildren}
                        viewport={viewport}
                        theme={website.theme}
                        websiteId={website.id}
                    />
                </div>
            ) : (
                <div className={`grid min-h-0 flex-1 ${canEditStructure ? "grid-cols-[240px_1fr_300px]" : "grid-cols-[1fr_300px]"}`}>
                    {canEditStructure && (
                        <aside className="overflow-y-auto border-r border-[var(--civo-color-border)] bg-[var(--civo-color-surface)]">
                            <ComponentPalette
                                onBeginDrag={dnd.beginPaletteDrag}
                                onDragPosition={dnd.updatePaletteDragPosition}
                                onDragEnd={dnd.endDrag}
                                onDragCancel={dnd.cancelDrag}
                                websiteId={website.id}
                                theme={website.theme}
                            />
                        </aside>
                    )}

                    <main className="overflow-y-auto bg-[var(--civo-color-background)] p-6">
                        <BuilderCanvas
                            nodes={isSwitchingPage ? [] : draftChildren}
                            selectedNodeId={selectedNodeId}
                            onSelect={(id) => dispatch(selectNode(id))}
                            viewport={viewport}
                            theme={website.theme}
                            containerRef={canvasContainerRef}
                            dnd={dnd}
                            websiteId={website.id}
                        />
                    </main>

                    <aside className="overflow-y-auto border-l border-[var(--civo-color-border)] bg-[var(--civo-color-surface)]">
                        <PropertiesPanel />
                    </aside>
                </div>
            )}
            
            {/* Renders globally on top of the UI during drag operations */}
            <DragOverlayCursor activeSource={dnd.activeSource} nodes={draftChildren} />
        </div>
    );
}
