"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { 
    createDatasetAction, 
    deleteDatasetAction, 
} from "@/modules/data-sources/application/dataset-actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { DataSourceMappingPanel } from "@/modules/data-sources/components/data-source-mapping-panel";
import type { DataSourceView } from "@/modules/data-sources/domain/data-source-schema";
import { CANONICAL_TYPE_LABELS, type DatasetView, type CanonicalType } from "@/modules/data-sources/domain/dataset-schema";
import { datasetMappingSchema } from "@/modules/data-sources/domain/field-mapping-schema";

export function DatasetManagementPanel({
    websiteId,
    dataSource,
    initialDatasets,
}: {
    websiteId: string;
    dataSource: DataSourceView;
    initialDatasets: DatasetView[];
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [datasets, setDatasets] = useState<DatasetView[]>(initialDatasets);
    const [isCreating, setIsCreating] = useState(false);
    const [expandedDatasetId, setExpandedDatasetId] = useState<string | null>(null);

    function handleDelete(datasetId: string) {
        if (!window.confirm("Diesen Datensatz und das zugehörige Mapping wirklich löschen? Komponenten, die diesen Datensatz verwenden, werden auf Beispieldaten zurückfallen.")) {
            return;
        }

        startTransition(async () => {
            const res = await deleteDatasetAction(datasetId, websiteId);
            if (res.ok) {
                setDatasets(datasets.filter(d => d.id !== datasetId));
                if (expandedDatasetId === datasetId) {
                    setExpandedDatasetId(null);
                }
                router.refresh();
            }
        });
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-medium text-copy">Datensätze</h3>
                <Button variant="outline" size="sm" onClick={() => setIsCreating(true)} disabled={isCreating || isPending}>
                    + Datensatz hinzufügen
                </Button>
            </div>

            {datasets.length === 0 && !isCreating ? (
                <div className="rounded-md border border-dashed p-4 text-center text-sm text-copy-muted">
                    Diese Quelle stellt noch keine Datensätze bereit. Fügen Sie einen Datensatz hinzu.
                </div>
            ) : (
                <div className="space-y-4">
                    {datasets.map((dataset) => (
                        <div key={dataset.id} className="rounded-md border p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-medium text-copy">{dataset.name}</h4>
                                    <p className="text-sm text-copy-muted">
                                        Typ: {CANONICAL_TYPE_LABELS[dataset.canonicalType as CanonicalType] ?? dataset.canonicalType}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => setExpandedDatasetId(expandedDatasetId === dataset.id ? null : dataset.id)}
                                    >
                                        {expandedDatasetId === dataset.id ? "Mapping ausblenden" : "Mapping bearbeiten"}
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(dataset.id)} disabled={isPending}>
                                        Löschen
                                    </Button>
                                </div>
                            </div>
                            
                            {expandedDatasetId === dataset.id && (
                                <div className="pt-4 border-t">
                                    <DataSourceMappingPanel
                                        websiteId={websiteId}
                                        datasetId={dataset.id}
                                        dataSourceId={dataSource.id}
                                        canonicalType={dataset.canonicalType as CanonicalType}
                                        existingMapping={dataset.mapping ? (datasetMappingSchema.safeParse(dataset.mapping).data ?? null) : null}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {isCreating && (
                <div className="rounded-md border p-4 bg-muted/20">
                    <DatasetForm 
                        websiteId={websiteId}
                        dataSourceId={dataSource.id}
                        onSaved={(newDataset) => {
                            setDatasets([...datasets, newDataset]);
                            setIsCreating(false);
                            setExpandedDatasetId(newDataset.id);
                        }}
                        onCancel={() => setIsCreating(false)}
                    />
                </div>
            )}
        </div>
    );
}

function DatasetForm({
    websiteId,
    dataSourceId,
    onSaved,
    onCancel
}: {
    websiteId: string;
    dataSourceId: string;
    onSaved: (dataset: DatasetView) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState("");
    const [canonicalType, setCanonicalType] = useState<CanonicalType>("Event");
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            const res = await createDatasetAction({ dataSourceId,
                name,
                canonicalType,
                slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            }, websiteId);
            
            if (!res.ok) {
                setError(res.message);
                return;
            }
            router.refresh();
            onSaved(res.data);
        });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h4 className="font-medium">Neuen Datensatz anlegen</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label htmlFor="dataset-name">Name</Label>
                    <Input 
                        id="dataset-name" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        placeholder="z.B. Veranstaltungen 2026" 
                        required 
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="dataset-type">Datensatz-Typ</Label>
                    <select
                        id="dataset-type"
                        value={canonicalType}
                        onChange={(e) => setCanonicalType(e.target.value as CanonicalType)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {Object.entries(CANONICAL_TYPE_LABELS).map(([type, label]) => (
                            <option key={type} value={type}>{label as string}</option>
                        ))}
                    </select>
                </div>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isPending}>
                    {isPending ? "Speichert..." : "Hinzufügen"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
                    Abbrechen
                </Button>
            </div>
        </form>
    );
}
