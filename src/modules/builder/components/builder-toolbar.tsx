"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { undo, redo } from "@/modules/builder/application/document-slice";
import { setMode, setViewport } from "@/modules/builder/application/ui-slice";
import { saveStarted, saveSucceeded, saveFailed } from "@/modules/builder/application/save-state-slice";
import { hasCapability } from "@/modules/builder/domain/editor-capabilities";
import {
    selectDraftChildren,
    selectIsDirty,
    selectSaveStatus,
    selectSaveError,
    selectBuilderMode,
    selectViewport,
    selectCanUndo,
    selectCanRedo,
    selectEditorMode,
} from "@/modules/builder/application/builder-selectors";
import { savePageConfigAction } from "@/modules/builder/application/page-actions";
import { Button } from "@/components/ui/button";
import { ToolbarLink } from "@/components/ui/toolbar-link";
import { Undo2, Redo2, Eye, Pencil, Monitor, Tablet, Smartphone, Settings, ArrowLeft, ExternalLink, PanelLeft, PanelRight } from "@/components/ui/icons";
import type { WebsiteTheme } from "@/modules/website/domain/theme";
import { cn } from "@/lib/utils/cn";

type BuilderToolbarProps = {
    website: { id: string; name: string; theme: WebsiteTheme };
    page: { id: string; title: string };
    /** Open the component palette sheet. Omitted when the palette isn't available (municipality mode). */
    onOpenPalette?: () => void;
    /** Open the properties sheet. */
    onOpenProperties: () => void;
};

const saveStatusLabel: Record<string, string> = {
    idle: "",
    saving: "Speichert…",
    saved: "Gespeichert",
    error: "Speichern fehlgeschlagen",
};

export function BuilderToolbar({ website, page, onOpenPalette, onOpenProperties }: BuilderToolbarProps) {
    const dispatch = useAppDispatch();
    const draftChildren = useAppSelector(selectDraftChildren);
    const isDirty = useAppSelector(selectIsDirty);
    const saveStatus = useAppSelector(selectSaveStatus);
    const saveError = useAppSelector(selectSaveError);
    const mode = useAppSelector(selectBuilderMode);
    const viewport = useAppSelector(selectViewport);
    const canUndo = useAppSelector(selectCanUndo);
    const canRedo = useAppSelector(selectCanRedo);
    const editorMode = useAppSelector(selectEditorMode);

    const canManageTheme = hasCapability(editorMode, "manageTheme");

    const handleSave = () => {
        dispatch(saveStarted());
        const config = { type: "page" as const, children: draftChildren };
        savePageConfigAction(page.id, website.id, config).then((result) => {
            if (!result.ok) {
                dispatch(saveFailed(result.message));
                return;
            }
            dispatch(saveSucceeded());
        });
    };

    // Keep a ref to the latest handleSave so the keydown listener below
    // can always call the current version (closing over up-to-date
    // draftChildren/page/website) without needing to re-subscribe the
    // window listener on every render — handleSave is redefined each
    // render, but this effect's own dependency array stays empty and
    // the listener is attached exactly once per mount. The ref is
    // updated from its own effect (not during render) since React
    // Compiler disallows ref writes in the render body.
    const handleSaveRef = useRef(handleSave);
    useEffect(() => {
        handleSaveRef.current = handleSave;
    });

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            const meta = event.metaKey || event.ctrlKey;
            if (meta && event.key.toLowerCase() === "s") {
                event.preventDefault();
                handleSaveRef.current();
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
        // Two rows below `lg` (title + status, then tools), one row above.
        // DOM order equals visual order, so keyboard focus order is natural.
        <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-surface px-4 py-2 lg:flex-row lg:items-center lg:justify-between lg:py-3">
            <div className="flex min-w-0 items-center justify-between gap-3 lg:justify-start">
                <nav aria-label="Brotkrumen" className="flex min-w-0 items-center gap-2 text-sm">
                    <Link
                        href="/websites"
                        className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1.5 rounded-token-sm text-copy-muted hover:text-copy pointer-coarse:h-11 pointer-coarse:min-w-11"
                    >
                        <ArrowLeft className="size-4" />
                        <span className="sr-only sm:not-sr-only">Websites</span>
                    </Link>
                    <span aria-hidden="true" className="text-border-strong">/</span>
                    <span className="truncate font-medium text-copy">{website.name}</span>
                    <span aria-hidden="true" className="hidden text-border-strong sm:inline">/</span>
                    <span className="hidden truncate text-copy-muted sm:inline">{page.title}</span>
                </nav>

                <SaveIndicator status={saveStatus} error={saveError} isDirty={isDirty} />
            </div>

            {/* Two clusters, so when the row is too narrow the wrap happens
                between them (edit tools | navigation + save) instead of
                stranding a single icon beside the Save button. */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 lg:flex-nowrap">
                <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                    {mode === "select" && (
                        <div className="flex items-center gap-1 lg:hidden">
                            {onOpenPalette && (
                                <Button variant="outline" size="sm" title="Komponenten" onClick={onOpenPalette}>
                                    <PanelLeft />
                                    <span className="sr-only">Komponenten</span>
                                </Button>
                            )}
                            <Button variant="outline" size="sm" title="Eigenschaften" onClick={onOpenProperties}>
                                <PanelRight />
                                <span className="sr-only">Eigenschaften</span>
                            </Button>
                        </div>
                    )}

                    <div className="flex items-center gap-1 rounded-token border border-border p-0.5">
                        <IconToggle
                            icon={<Undo2 className="size-3.5" />}
                            label="Rückgängig"
                            disabled={!canUndo}
                            onClick={() => dispatch(undo())}
                        />
                        <IconToggle
                            icon={<Redo2 className="size-3.5" />}
                            label="Wiederholen"
                            disabled={!canRedo}
                            onClick={() => dispatch(redo())}
                        />
                    </div>

                    {/* The canvas fills a phone's width already; previewing a "mobile"
                        frame there is meaningless, so the switcher starts at `md`. */}
                    {mode === "select" && (
                        <div className="hidden items-center gap-1 rounded-token border border-border p-0.5 md:flex">
                            <IconToggle
                                icon={<Monitor className="size-3.5" />}
                                label="Desktop"
                                active={viewport === "desktop"}
                                onClick={() => dispatch(setViewport("desktop"))}
                            />
                            <IconToggle
                                icon={<Tablet className="size-3.5" />}
                                label="Tablet"
                                active={viewport === "tablet"}
                                onClick={() => dispatch(setViewport("tablet"))}
                            />
                            <IconToggle
                                icon={<Smartphone className="size-3.5" />}
                                label="Mobil"
                                active={viewport === "mobile"}
                                onClick={() => dispatch(setViewport("mobile"))}
                            />
                        </div>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => dispatch(setMode(mode === "preview" ? "select" : "preview"))}
                    >
                        {mode === "preview" ? (
                            <>
                                <Pencil /> <span className="sr-only sm:not-sr-only">Bearbeiten</span>
                            </>
                        ) : (
                            <>
                                <Eye /> <span className="sr-only sm:not-sr-only">Vorschau</span>
                            </>
                        )}
                    </Button>
                </div>

                <div className="ml-auto flex items-center gap-2 lg:gap-3">
                    <ToolbarLink href={`/s/${website.id}`} label="Öffentliche Seite" icon={<ExternalLink className="size-4" />} newTab />

                    {canManageTheme && (
                        <ToolbarLink href={`/websites/${website.id}/settings`} label="Einstellungen" icon={<Settings className="size-4" />} />
                    )}

                    <Button size="sm" onClick={handleSave} disabled={saveStatus === "saving" || !isDirty}>
                        {saveStatus === "saving" ? "Speichert…" : "Speichern"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function IconToggle({
                        icon,
                        label,
                        active,
                        disabled,
                        onClick,
                    }: {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            onClick={onClick}
            title={label}
            className={cn(
                "flex size-7 items-center justify-center rounded-token-sm text-copy-muted disabled:opacity-30 pointer-coarse:size-11",
                active && "bg-canvas text-copy",
                !disabled && "hover:bg-canvas"
            )}
        >
            {icon}
        </button>
    );
}

/**
 * The status region is always mounted: screen readers only announce changes
 * to a live region that already exists. Errors use role="alert" so they
 * interrupt; the rest are polite. Unsaved uses the warning token (accent
 * text on white is 3.4:1, below the 4.5:1 AA needs at this size).
 */
function SaveIndicator({
                           status,
                           error,
                           isDirty,
                       }: {
    status: string;
    error: string | null;
    isDirty: boolean;
}) {
    let content: React.ReactNode = null;
    if (status === "error") {
        const message = error ?? saveStatusLabel.error;
        content = (
            <span role="alert" title={message} className="block truncate text-xs text-danger">
                {message}
            </span>
        );
    } else if (status === "saving") {
        content = <span className="text-xs text-copy-muted">{saveStatusLabel.saving}</span>;
    } else if (isDirty) {
        content = <span className="text-xs text-warning">Ungespeicherte Änderungen</span>;
    } else if (status === "saved") {
        content = <span className="text-xs text-copy-muted">{saveStatusLabel.saved}</span>;
    }
    return (
        <div role="status" className="min-w-0 max-w-2/5 truncate lg:max-w-xs">
            {content}
        </div>
    );
}
