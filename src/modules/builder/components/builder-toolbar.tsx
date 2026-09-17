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
import { Undo2, Redo2, Eye, Pencil, Monitor, Tablet, Smartphone, Settings } from "@/components/ui/icons";
import type { WebsiteTheme } from "@/modules/website/domain/theme";
import { cn } from "@/lib/utils/cn";

type BuilderToolbarProps = {
    website: { id: string; name: string; theme: WebsiteTheme };
    page: { id: string; title: string };
};

const saveStatusLabel: Record<string, string> = {
    idle: "",
    saving: "Speichert…",
    saved: "Gespeichert",
    error: "Speichern fehlgeschlagen",
};

export function BuilderToolbar({ website, page }: BuilderToolbarProps) {
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
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--civo-color-border)] bg-[var(--civo-color-surface)] px-4">
            <div className="flex items-center gap-2 text-sm">
                <Link href="/websites" className="text-[var(--civo-color-text-muted)] hover:underline">
                    ← Websites
                </Link>
                <span className="text-[var(--civo-color-border)]">/</span>
                <span className="font-medium text-[var(--civo-color-text)]">{website.name}</span>
                <span className="text-[var(--civo-color-border)]">/</span>
                <span className="text-[var(--civo-color-text-muted)]">{page.title}</span>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 rounded-[var(--civo-radius)] border border-[var(--civo-color-border)] p-0.5">
                    <IconToggle
                        icon={<Undo2 className="h-3.5 w-3.5" />}
                        label="Rückgängig"
                        disabled={!canUndo}
                        onClick={() => dispatch(undo())}
                    />
                    <IconToggle
                        icon={<Redo2 className="h-3.5 w-3.5" />}
                        label="Wiederholen"
                        disabled={!canRedo}
                        onClick={() => dispatch(redo())}
                    />
                </div>

                {mode === "select" && (
                    <div className="flex items-center gap-1 rounded-[var(--civo-radius)] border border-[var(--civo-color-border)] p-0.5">
                        <IconToggle
                            icon={<Monitor className="h-3.5 w-3.5" />}
                            label="Desktop"
                            active={viewport === "desktop"}
                            onClick={() => dispatch(setViewport("desktop"))}
                        />
                        <IconToggle
                            icon={<Tablet className="h-3.5 w-3.5" />}
                            label="Tablet"
                            active={viewport === "tablet"}
                            onClick={() => dispatch(setViewport("tablet"))}
                        />
                        <IconToggle
                            icon={<Smartphone className="h-3.5 w-3.5" />}
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
                            <Pencil className="h-3.5 w-3.5" /> Bearbeiten
                        </>
                    ) : (
                        <>
                            <Eye className="h-3.5 w-3.5" /> Vorschau
                        </>
                    )}
                </Button>

                <Link
                    href={`/s/${website.id}`}
                    target="_blank"
                    className="text-sm text-[var(--civo-color-text-muted)] hover:underline"
                >
                    Öffentliche Seite
                </Link>

                {canManageTheme && (
                    <Link
                        href={`/websites/${website.id}/settings`}
                        className="flex items-center gap-1.5 text-sm text-[var(--civo-color-text-muted)] hover:text-[var(--civo-color-text)]"
                    >
                        <Settings className="h-4 w-4" />
                        Einstellungen
                    </Link>
                )}

                <SaveIndicator status={saveStatus} error={saveError} isDirty={isDirty} />

                <Button size="sm" onClick={handleSave} disabled={saveStatus === "saving" || !isDirty}>
                    {saveStatus === "saving" ? "Speichert…" : "Speichern"}
                </Button>
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
                "flex h-7 w-7 items-center justify-center rounded-[calc(var(--civo-radius)_-_2px)] text-[var(--civo-color-text-muted)] disabled:opacity-30",
                active && "bg-[var(--civo-color-background)] text-[var(--civo-color-text)]",
                !disabled && "hover:bg-[var(--civo-color-background)]"
            )}
        >
            {icon}
        </button>
    );
}

function SaveIndicator({
                           status,
                           error,
                           isDirty,
                       }: {
    status: string;
    error: string | null;
    isDirty: boolean;
}) {
    if (status === "error") {
        return <span className="text-xs text-red-700">{error ?? saveStatusLabel.error}</span>;
    }
    if (status === "saving") {
        return <span className="text-xs text-[var(--civo-color-text-muted)]">{saveStatusLabel.saving}</span>;
    }
    if (isDirty) {
        return <span className="text-xs text-[var(--civo-color-accent)]">Ungespeicherte Änderungen</span>;
    }
    if (status === "saved") {
        return <span className="text-xs text-[var(--civo-color-text-muted)]">{saveStatusLabel.saved}</span>;
    }
    return null;
}
