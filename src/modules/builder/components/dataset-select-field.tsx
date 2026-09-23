"use client";

import { useEffect, useState } from "react";
import type { CanonicalType, DatasetView } from "@/modules/data-sources/application/dataset-service";
import { listCompatibleDatasetsAction } from "@/modules/data-sources/application/dataset-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DatasetSelectField({
    id,
    websiteId,
    canonicalType,
    value,
    onChange,
    onCommit,
}: {
    id: string;
    websiteId?: string;
    canonicalType?: CanonicalType;
    value: unknown;
    onChange: (value: unknown) => void;
    onCommit: () => void;
}) {
    const [options, setOptions] = useState<DatasetView[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!websiteId || !canonicalType) return;
        let active = true;

        async function load() {
            setLoading(true);
            setError(null);
            const result = await listCompatibleDatasetsAction(websiteId!, canonicalType!);
            if (!active) return;
            setLoading(false);

            if (result.ok) {
                setOptions(result.data);
            } else {
                setError(result.message);
            }
        }

        void load();

        return () => {
            active = false;
        };
    }, [websiteId, canonicalType]);

    if (!websiteId || !canonicalType) {
        return (
            <div className="rounded-[calc(var(--civo-radius)_-_2px)] border border-dashed border-[var(--civo-color-border)] bg-[var(--civo-color-surface-muted)] p-2 text-xs text-[var(--civo-color-text-muted)]">
                Kontext fehlt.
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-[calc(var(--civo-radius)_-_2px)] border border-red-200 bg-red-50 p-2 text-xs text-red-600">
                Ladefehler: {error}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="rounded-[calc(var(--civo-radius)_-_2px)] border border-[var(--civo-color-border)] bg-[var(--civo-color-surface-muted)] p-2 text-xs text-[var(--civo-color-text-muted)] animate-pulse">
                Datensätze werden geladen...
            </div>
        );
    }

    return (
        <Select
            value={value ? String(value) : "none"}
            onValueChange={(val) => {
                onChange(val === "none" ? undefined : val);
                onCommit();
            }}
        >
            <SelectTrigger id={id} className="w-full h-9">
                <SelectValue placeholder="Beispieldaten (kein Datensatz)" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="none">Beispieldaten (kein Datensatz)</SelectItem>
                {options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                        {option.name} ({option.sourceName})
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
