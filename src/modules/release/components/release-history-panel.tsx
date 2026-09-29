"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { rollbackReleaseAction } from "@/modules/release/application/release-actions";
import type { WebsiteRelease } from "@prisma/client";
import { RotateCcw, CheckCircle2, XCircle, Clock, ArchiveX } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";

type Props = {
    websiteId: string;
    /** Pre-loaded on the server so the panel renders immediately without a client fetch. */
    releases: WebsiteRelease[];
    /** The currently active release ID (Website.publishedReleaseId). */
    currentReleaseId: string | null;
};

const statusLabel: Record<string, string> = {
    PUBLISHED: "Veröffentlicht",
    ROLLED_BACK: "Zurückgerollt",
    FAILED: "Fehlgeschlagen",
    DRAFT: "Entwurf",
};

const statusVariant: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
> = {
    PUBLISHED: "default",
    ROLLED_BACK: "secondary",
    FAILED: "destructive",
    DRAFT: "outline",
};

/**
 * Release history panel for the Settings page (Phase 4I).
 *
 * Shows all releases for a website (newest first) with their status,
 * number, and publish date. Allows rolling back to any previously-
 * published release via `rollbackReleaseAction`.
 *
 * Design decisions:
 * - Renders initial list from server-side props so there is no loading
 *   flash for the common case (Phase 42: publish-time freeze, not
 *   per-request resolution).
 * - The currently-live release is highlighted and has no rollback button.
 * - Rollback is disabled while a transition is pending so the user cannot
 *   double-click and launch two concurrent state transitions.
 * - Failed/Draft releases cannot be rolled back — only PUBLISHED and
 *   ROLLED_BACK releases represent successfully-built artifacts.
 */
export function ReleaseHistoryPanel({ websiteId, releases, currentReleaseId }: Props) {
    const [currentActive, setCurrentActive] = useState<string | null>(currentReleaseId);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleRollback = (targetReleaseId: string) => {
        setError(null);
        startTransition(async () => {
            const result = await rollbackReleaseAction(websiteId, targetReleaseId);
            if (!result.ok) {
                setError(result.message);
                return;
            }
            setCurrentActive(targetReleaseId);
        });
    };

    if (releases.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-token border border-dashed border-border px-6 py-12 text-center">
                <ArchiveX className="size-8 text-copy-muted" />
                <p className="text-sm text-copy-muted">
                    Noch keine Releases veröffentlicht. Öffnen Sie den Builder und klicken Sie auf
                    „Veröffentlichen&quot;, um das erste Release zu erstellen.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {error && (
                <div
                    role="alert"
                    className="rounded-token border border-danger bg-danger/10 px-4 py-3 text-sm text-danger"
                >
                    {error}
                </div>
            )}

            <ul className="flex flex-col gap-2" aria-label="Release-Verlauf">
                {releases.map((release) => {
                    const isActive = release.id === currentActive;
                    const canRollback =
                        !isActive &&
                        (release.status === "PUBLISHED" || release.status === "ROLLED_BACK");

                    return (
                        <li
                            key={release.id}
                            className={cn(
                                "flex flex-col gap-2 rounded-token border p-4 sm:flex-row sm:items-center sm:justify-between",
                                isActive
                                    ? "border-accent bg-accent/5"
                                    : "border-border bg-surface"
                            )}
                        >
                            {/* Release identity */}
                            <div className="flex min-w-0 flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-copy">
                                        Release #{release.releaseNumber}
                                    </span>
                                    <Badge variant={statusVariant[release.status] ?? "outline"}>
                                        {statusLabel[release.status] ?? release.status}
                                    </Badge>
                                    {isActive && (
                                        <Badge variant="default" className="bg-accent text-accent-foreground">
                                            Aktiv
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-copy-muted">
                                    {release.publishedAt && (
                                        <span className="flex items-center gap-1">
                                            <CheckCircle2 className="size-3" />
                                            Veröffentlicht:{" "}
                                            {new Date(release.publishedAt).toLocaleString("de-DE", {
                                                dateStyle: "medium",
                                                timeStyle: "short",
                                            })}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        <Clock className="size-3" />
                                        Erstellt:{" "}
                                        {new Date(release.createdAt).toLocaleString("de-DE", {
                                            dateStyle: "medium",
                                            timeStyle: "short",
                                        })}
                                    </span>
                                </div>
                            </div>

                            {/* Rollback action */}
                            {canRollback ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isPending}
                                    onClick={() => handleRollback(release.id)}
                                    className="shrink-0"
                                    title={`Zu Release #${release.releaseNumber} zurückrollen`}
                                >
                                    <RotateCcw className="size-3.5" />
                                    <span className="ml-1.5">Wiederherstellen</span>
                                </Button>
                            ) : release.status === "FAILED" ? (
                                <div className="flex shrink-0 items-center gap-1.5 text-xs text-danger">
                                    <XCircle className="size-3.5" />
                                    <span>Build fehlgeschlagen</span>
                                </div>
                            ) : null}
                        </li>
                    );
                })}
            </ul>

            <p className="text-xs text-copy-muted">
                Das Wiederherstellen eines Releases aktiviert die unveränderliche Version von damals
                \u2014 keine Neuerstellung erforderlich.
            </p>
        </div>
    );
}
