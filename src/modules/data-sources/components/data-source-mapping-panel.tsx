"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    discoverDataSourceAction,
    previewDataSourceMappingAction,
    saveDataSourceMappingAction,
} from "@/modules/data-sources/application/data-source-actions";
import { Button } from "@/components/ui/button";
import { CANONICAL_TARGET_FIELDS, type FieldMapping } from "@/modules/data-sources/domain/field-mapping-schema";
import type { DiscoveredField } from "@/modules/data-sources/domain/data-source-adapter";
import type { DataSourceDataset } from "@/modules/data-sources/domain/data-source-schema";
import { describeConnectionFailure } from "@/modules/data-sources/components/describe-connection-failure";

type DataSourceMappingPanelProps = {
    websiteId: string;
    dataSourceId: string;
    dataset: DataSourceDataset;
};

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
export function DataSourceMappingPanel({ websiteId, dataSourceId, dataset }: DataSourceMappingPanelProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [fields, setFields] = useState<DiscoveredField[] | null>(null);
    const [assignments, setAssignments] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
    const [saved, setSaved] = useState(false);

    const targetFields = CANONICAL_TARGET_FIELDS[dataset];

    function handleDiscover() {
        setError(null);
        setSaved(false);
        startTransition(async () => {
            const result = await discoverDataSourceAction(dataSourceId);
            if (!result.ok) {
                setError(describeConnectionFailure(result.category, result.message));
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
        setPreview(null);
        setSaved(false);
    }

    function buildMapping(): FieldMapping[] {
        return Object.entries(assignments).map(([sourcePath, targetPath]) => ({
            sourcePath,
            targetPath,
            required: targetFields.find((f) => f.path === targetPath)?.required ?? false,
        }));
    }

    function handlePreview() {
        setError(null);
        const mappingFields = buildMapping();
        if (mappingFields.length === 0) {
            setError("Ordnen Sie mindestens ein Feld zu, bevor Sie eine Vorschau anzeigen.");
            return;
        }

        startTransition(async () => {
            const result = await previewDataSourceMappingAction(dataSourceId, { fields: mappingFields });
            if (!result.ok) {
                setError(result.message);
                setPreview(null);
                return;
            }
            setPreview(result.value);
        });
    }

    function handleSave() {
        setError(null);
        const mappingFields = buildMapping();
        const missingRequired = targetFields.filter((f) => f.required && !mappingFields.some((m) => m.targetPath === f.path));
        if (missingRequired.length > 0) {
            setError(`Pflichtfelder fehlen: ${missingRequired.map((f) => f.label).join(", ")}.`);
            return;
        }

        startTransition(async () => {
            const result = await saveDataSourceMappingAction(dataSourceId, { fields: mappingFields }, websiteId);
            if (!result.ok) {
                setError(result.message);
                return;
            }
            setSaved(true);
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

            {error && <p className="text-sm text-red-700">{error}</p>}

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
                                    {fields.map((field) => (
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
                                                        <option key={target.path} value={target.path}>
                                                            {target.label}
                                                            {target.required ? " *" : ""}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
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

                    {saved && <p className="text-sm text-green-700">Mapping gespeichert.</p>}

                    {preview && (
                        <div className="rounded-[var(--civo-radius)] border border-[var(--civo-color-border)] bg-[var(--civo-color-background)] p-3">
                            <p className="mb-1.5 text-xs font-medium text-[var(--civo-color-text-muted)]">
                                Vorschau des zugeordneten Datensatzes
                            </p>
                            <pre className="overflow-x-auto text-xs text-[var(--civo-color-text)]">
                                {JSON.stringify(preview, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
