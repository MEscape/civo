"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loadPage, undo, redo, selectNode, removeNodeAction } from "@/modules/builder/application/document-slice";
import { selectIsDirty, selectSelectedNodeId, selectBuilderMode, selectViewport, selectDraftChildren } from "@/modules/builder/application/builder-selectors";
import type { PageNode } from "@/modules/builder/domain/page-node";
import { ComponentPalette } from "@/modules/builder/components/component-palette";
import { BuilderCanvas } from "@/modules/builder/components/builder-canvas";
import { PropertiesPanel } from "@/modules/builder/components/properties-panel";
import { PreviewCanvas } from "@/modules/builder/components/preview-canvas";
import type { WebsiteTheme } from "@/modules/website/domain/theme";
import { BuilderToolbar } from "./builder-toolbar";

type BuilderShellProps = {
    website: { id: string; name: string; theme: WebsiteTheme };
    page: { id: string; title: string };
    initialChildren: PageNode[];
};

/**
 * The builder shell. Connects keyboard shortcuts, warning on unload,
 * and sets up the three-column layout wrapping the core canvas.
 */
export function BuilderShell({ website, page, initialChildren }: BuilderShellProps) {
    const dispatch = useAppDispatch();
    const draftChildren = useAppSelector(selectDraftChildren);
    const isDirty = useAppSelector(selectIsDirty);
    const selectedNodeId = useAppSelector(selectSelectedNodeId);
    const mode = useAppSelector(selectBuilderMode);
    const viewport = useAppSelector(selectViewport);

    useEffect(() => {
        dispatch(loadPage({ pageId: page.id, children: initialChildren }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page.id]);

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

            // Save shortcut is handled in Toolbar? Wait, no, we need it here, or we can move it to Toolbar.
            // Let's just keep undo/redo/escape/delete here since they interact with document state.
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
                        nodes={draftChildren}
                        viewport={viewport}
                        theme={website.theme}
                    />
                </div>
            ) : (
                <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr_300px]">
                    <aside className="overflow-y-auto border-r border-[var(--civo-color-border)] bg-[var(--civo-color-surface)]">
                        <ComponentPalette />
                    </aside>

                    <main className="overflow-y-auto bg-[var(--civo-color-background)] p-6">
                        <BuilderCanvas
                            nodes={draftChildren}
                            selectedNodeId={selectedNodeId}
                            onSelect={(id) => dispatch(selectNode(id))}
                            viewport={viewport}
                            theme={website.theme}
                        />
                    </main>

                    <aside className="overflow-y-auto border-l border-[var(--civo-color-border)] bg-[var(--civo-color-surface)]">
                        <PropertiesPanel />
                    </aside>
                </div>
            )}
        </div>
    );
}
