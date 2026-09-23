"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    discoverDatasetAction,
    previewDatasetMappingAction,
    saveDatasetMappingAction,
} from "@/modules/data-sources/application/dataset-actions";
import { Button } from "@/components/ui/button";
import { CANONICAL_TARGET_FIELDS, type FieldMapping } from "@/modules/data-sources/domain/field-mapping-schema";
import type { DiscoveredField } from "@/modules/data-sources/domain/data-source-adapter";
import type { CanonicalType } from "@/modules/data-sources/domain/dataset-schema";
import { describeConnectionFailure } from "@/modules/data-sources/components/describe-connection-failure";

/**
 * Display labels for canonical target fields, by dataset. Kept here
 * rather than in the domain layer: the domain owns which paths exist and
 * which are required (`CANONICAL_TARGET_FIELDS`), but the German label
 * text is a presentation concern, and the only thing that renders it.
 */
const TARGET_FIELD_LABELS: Record<string, Record<string, string>> = {
    Event: { title: "Titel", description: "Beschreibung", startDate: "Startdatum", endDate: "Enddatum", location: "Ort", category: "Kategorie", imageUrl: "Bild-URL" },
    NewsItem: { title: "Titel", excerpt: "Auszug", category: "Kategorie", imageUrl: "Bild-URL", publishedAt: "Veröffentlichungsdatum", slug: "URL-Slug", content: "Inhalt" },
    Service: { title: "Titel", description: "Beschreibung", href: "Link", icon: "Icon-Name" },
    Contact: { name: "Name", role: "Rolle", email: "E-Mail", phone: "Telefon" },
    Alert: { title: "Titel", message: "Nachricht", severity: "Schweregrad", active: "Aktiv", href: "Link" },
    SmartCityMetric: { label: "Bezeichnung", value: "Wert", unit: "Einheit", category: "Kategorie", trend: "Trend", changePercent: "Veränderung (%)" },
};

type DataSourceMappingPanelProps = {
    websiteId: string;
    dataSourceId: string;
    datasetId: string;
    canonicalType: CanonicalType;
    /** The mapping already saved for this source, if any, so reopening the panel does not discard it. */
    existingMapping?: { fields: FieldMapping[] } | null;
};

/**
 * The panel's outcome after the most recent user-triggered action. A
 * single discriminated union instead of separate `error`/`preview`/
 * `saved` booleans: those three were mutually exclusive in practice
 * (every state change reset the other two), which a union makes
 * structural instead of a convention to remember at each call site.
 */
type PanelStatus =
    | { kind: "idle" }
    | { kind: "error"; message: string }
    | { kind: "previewed"; value: Record<string, unknown> }
    | { kind: "saved" };

/** Builds the `sourcePath -> targetPath` map a saved mapping implies, for preloading the assignment table. */
function assignmentsFromMapping(mapping: { fields: FieldMapping[] } | null | undefined): Record<string, string> {
    if (!mapping) return {};

    return Object.fromEntries(mapping.fields.map((field) => [field.sourcePath, field.targetPath]));
}

/**
 * Discovery + mapping UI (spec §7, §9). Two steps in one panel:
 *  1. "Felder laden" runs discovery against the live source and shows
 *     the fields it found (spec §7 — discovery, not yet mapping).
 *  2. For each discovered field, the admin picks which canonical target
 *     field it fills, with a live preview of the mapped result before
 *     saving (spec §10 — validated canonical data, not blind trust).
 *
 * Deliberately no "transform" picker in this first UI pass — every
 * mapping here is a direct field-to-field assignment (no join/fallback/
 * type-coercion authoring), which covers the common municipal case (spec
 * §24's worked example) without exposing the full transform vocabulary
 * field-mapping-schema.ts supports. The schema already allows richer
 * transforms for a future editor to add without a data-model change.
 */
export function DataSourceMappingPanel({ websiteId, dataSourceId, datasetId, canonicalType, existingMapping }: DataSourceMappingPanelProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [fields, setFields] = useState<DiscoveredField[] | null>(null);
    // Preloaded from the saved mapping, if any (previously always started
    // empty, so reopening this panel silently offered to overwrite a
    // working mapping with nothing assigned).
    const [assignments, setAssignments] = useState<Record<string, string>>(() => assignmentsFromMapping(existingMapping));
    const [status, setStatus] = useState<PanelStatus>({ kind: "idle" });

    const targetFields = CANONICAL_TARGET_FIELDS[canonicalType] ?? [];
    const labels = TARGET_FIELD_LABELS[canonicalType] ?? {};

    function targetLabel(path: string): string {
        return labels[path] ?? path;
    }

    /** Target paths already claimed by a different source field than `excludingSourcePath`. */
    function targetsUsedElsewhere(excludingSourcePath: string): Set<string> {
        return new Set(
            Object.entries(assignments)
                .filter(([sourcePath]) => sourcePath !== excludingSourcePath)
                .map(([, targetPath]) => targetPath)
        );
    }

    function handleDiscover() {
        setStatus({ kind: "idle" });
        startTransition(async () => {
            const result = await discoverDatasetAction(datasetId, websiteId);
            if (!result.ok) {
                setStatus({ kind: "error", message: describeConnectionFailure(result.category, result.message) });
                return;
            }
            setFields(result.data.fields);
        });
    }

    function handleAssign(fieldPath: string, targetPath: string) {
        setAssignments((prev) => {
            const next = { ...prev };
            if (targetPath === "") {
                delete next[fieldPath];
            } else {
                next[fieldPath] = targetPath;
            }
            return next;
        });
        setStatus({ kind: "idle" });
    }

    function buildMapping(): FieldMapping[] {
        return Object.entries(assignments).map(([sourcePath, targetPath]) => ({
            sourcePath,
            targetPath,
            required: targetFields.find((f) => f.path === targetPath)?.required ?? false,
        }));
    }

    function handlePreview() {
        const mappingFields = buildMapping();
        if (mappingFields.length === 0) {
            setStatus({ kind: "error", message: "Ordnen Sie mindestens ein Feld zu, bevor Sie eine Vorschau anzeigen." });
            return;
        }

        startTransition(async () => {
            const result = await previewDatasetMappingAction(datasetId, websiteId, { fields: mappingFields });
            if (!result.ok) {
                setStatus({ kind: "error", message: result.message });
                return;
            }
            setStatus({ kind: "previewed", value: result.value });
        });
    }

    function handleSave() {
        const mappingFields = buildMapping();
        const missingRequired = targetFields.filter(
            (f) => f.required && !mappingFields.some((m) => m.targetPath === f.path)
        );
        if (missingRequired.length > 0) {
            setStatus({
                kind: "error",
                message: `Pflichtfelder fehlen: ${missingRequired.map((f) => targetLabel(f.path)).join(", ")}.`,
            });
            return;
        }

        startTransition(async () => {
            const result = await saveDatasetMappingAction(datasetId, { fields: mappingFields }, websiteId);
            if (!result.ok) {
                setStatus({ kind: "error", message: result.message });
                return;
            }
            setStatus({ kind: "saved" });
            router.refresh();
        });
    }

    return (
        <div className="space-y-3 border-t border-[var(--civo-color-border)] pt-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-[var(--civo-color-text)]">Felder zuordnen</h4>
                <Button type="button" variant="outline" size="sm" onClick={handleDiscover} disabled={isPending}>
                    {isPending ? "Lädt…" : "Felder laden"}
                </Button>
            </div>

            {status.kind === "error" && <p className="text-sm text-red-700">{status.message}</p>}

            {fields && (
                <div className="space-y-3">
                    {fields.length === 0 ? (
                        <p className="text-sm text-[var(--civo-color-text-muted)]">
                            In der Antwort der Datenquelle wurden keine Felder gefunden.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                <tr className="border-b border-[var(--civo-color-border)] text-left text-[var(--civo-color-text-muted)]">
                                    <th className="py-1.5 pr-3 font-medium">Externes Feld</th>
                                    <th className="py-1.5 pr-3 font-medium">Beispielwert</th>
                                    <th className="py-1.5 font-medium">Zielfeld</th>
                                </tr>
                                </thead>
                                <tbody>
                                {fields.map((field) => {
                                    const usedElsewhere = targetsUsedElsewhere(field.path);

                                    return (
                                        <tr key={field.path} className="border-b border-[var(--civo-color-border)] last:border-0">
                                            <td className="py-1.5 pr-3 font-mono text-xs text-[var(--civo-color-text)]">
                                                {field.path}
                                            </td>
                                            <td className="py-1.5 pr-3 truncate max-w-[160px] text-[var(--civo-color-text-muted)]">
                                                {field.sampleValue}
                                            </td>
                                            <td className="py-1.5">
                                                <select
                                                    value={assignments[field.path] ?? ""}
                                                    onChange={(e) => handleAssign(field.path, e.target.value)}
                                                    className="h-8 w-full max-w-[220px] rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                >
                                                    <option value="">Nicht zugeordnet</option>
                                                    {targetFields.map((target) => (
                                                        <option
                                                            key={target.path}
                                                            value={target.path}
                                                            // A target already assigned to a different source
                                                            // field is disabled rather than silently allowed a
                                                            // second time — assigning it here would silently
                                                            // clobber the other assignment (spec §10, last write
                                                            // wins is not an acceptable outcome for a canonical
                                                            // field).
                                                            disabled={usedElsewhere.has(target.path)}
                                                        >
                                                            {targetLabel(target.path)}
                                                            {target.required ? " *" : ""}
                                                            {usedElsewhere.has(target.path) ? " (bereits zugeordnet)" : ""}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handlePreview} disabled={isPending}>
                            Vorschau
                        </Button>
                        <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
                            {isPending ? "Speichert…" : "Mapping speichern"}
                        </Button>
                    </div>

                    {status.kind === "saved" && <p className="text-sm text-green-700">Mapping gespeichert.</p>}

                    {status.kind === "previewed" && (
                        <div className="rounded-[var(--civo-radius)] border border-[var(--civo-color-border)] bg-[var(--civo-color-background)] p-3">
                            <p className="mb-1.5 text-xs font-medium text-[var(--civo-color-text-muted)]">
                                Vorschau des zugeordneten Datensatzes
                            </p>
                            <pre className="overflow-x-auto text-xs text-[var(--civo-color-text)]">
                                {JSON.stringify(status.value, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
