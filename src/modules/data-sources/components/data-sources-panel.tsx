"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    upsertDataSourceAction,
    deleteDataSourceAction,
    testDataSourceConnectionAction,
} from "@/modules/data-sources/application/data-source-actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DataSourceStatusBadge } from "@/modules/data-sources/components/data-source-status-badge";
import { formatRelativeTime } from "@/modules/data-sources/components/format-relative-time";
import { DataSourceMappingPanel } from "@/modules/data-sources/components/data-source-mapping-panel";
import { describeConnectionFailure } from "@/modules/data-sources/components/describe-connection-failure";
import type { DataSourceRow } from "@/modules/data-sources/infrastructure/data-source-service";
import type { AuthMode, DataSourceDataset, DataSourceKind } from "@/modules/data-sources/domain/data-source-schema";

type DataSourcesPanelProps = {
    websiteId: string;
    initialSources: DataSourceRow[];
};

const DATASET_LABEL: Record<DataSourceDataset, string> = {
    civic: "Bürgerdaten (Veranstaltungen, News, Services, Kontakte)",
    smartcity: "Smart-City-Daten (Sensoren, Kennzahlen)",
};

/**
 * Root client component for Settings → Data Sources (spec §3). A
 * municipality has at most one configured source per canonical dataset
 * (civic / smartcity — spec §11's "Data Source → Canonical Dataset"),
 * so this renders one card per dataset rather than an open-ended list:
 * either the dataset is unconfigured (falls back to sample/mock data —
 * spec §25) or it has exactly one REST connection, editable in place.
 */
export function DataSourcesPanel({ websiteId, initialSources }: DataSourcesPanelProps) {
    const sourceByDataset = new Map(initialSources.map((source) => [source.dataset, source]));

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-[var(--civo-color-text)]">Datenquellen</h2>
                <p className="mt-1 text-sm text-[var(--civo-color-text-muted)]">
                    Verbinden Sie kommunale und Smart-City-Datenquellen, um Ihren Website-Komponenten echte Daten
                    zur Verfügung zu stellen.
                </p>
            </div>

            {(Object.keys(DATASET_LABEL) as DataSourceDataset[]).map((dataset) => (
                <DatasetSourceCard
                    key={dataset}
                    websiteId={websiteId}
                    dataset={dataset}
                    source={sourceByDataset.get(dataset) ?? null}
                />
            ))}
        </div>
    );
}

function DatasetSourceCard({
    websiteId,
    dataset,
    source,
}: {
    websiteId: string;
    dataset: DataSourceDataset;
    source: DataSourceRow | null;
}) {
    const [isEditing, setIsEditing] = useState(!source);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                    <CardTitle>{DATASET_LABEL[dataset]}</CardTitle>
                    <CardDescription className="mt-1">
                        {source ? source.name : "Es ist noch keine Datenquelle konfiguriert — es werden Beispieldaten angezeigt."}
                    </CardDescription>
                </div>
                {source && !isEditing && <DataSourceStatusBadge status={source.status} />}
            </CardHeader>
            <CardContent className="space-y-4">
                {source && !isEditing ? (
                    <ConfiguredSourceView
                        websiteId={websiteId}
                        source={source}
                        onEdit={() => setIsEditing(true)}
                    />
                ) : (
                    <DataSourceForm
                        websiteId={websiteId}
                        dataset={dataset}
                        existing={source}
                        onCancel={source ? () => setIsEditing(false) : undefined}
                        onSaved={() => setIsEditing(false)}
                    />
                )}
            </CardContent>
        </Card>
    );
}

function ConfiguredSourceView({
    websiteId,
    source,
    onEdit,
}: {
    websiteId: string;
    source: DataSourceRow;
    onEdit: () => void;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [testMessage, setTestMessage] = useState<string | null>(null);

    const config = source.config as { baseUrl?: string };

    function handleTestConnection() {
        setTestMessage(null);
        startTransition(async () => {
            const result = await testDataSourceConnectionAction(source.id, websiteId);
            setTestMessage(
                result.ok
                    ? `Verbindung erfolgreich (${result.responseTimeMs} ms).`
                    : describeConnectionFailure(result.category, result.message)
            );
            router.refresh();
        });
    }

    function handleDelete() {
        if (!window.confirm("Diese Datenquelle wirklich entfernen? Die Website zeigt danach wieder Beispieldaten.")) {
            return;
        }
        startTransition(async () => {
            const result = await deleteDataSourceAction(source.id, websiteId);
            if (result.ok) router.refresh();
        });
    }

    return (
        <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                    <dt className="text-[var(--civo-color-text-muted)]">Typ</dt>
                    <dd className="text-[var(--civo-color-text)]">REST / JSON</dd>
                </div>
                <div>
                    <dt className="text-[var(--civo-color-text-muted)]">URL</dt>
                    <dd className="truncate text-[var(--civo-color-text)]">{config.baseUrl ?? "—"}</dd>
                </div>
                <div>
                    <dt className="text-[var(--civo-color-text-muted)]">Zuletzt geprüft</dt>
                    <dd className="text-[var(--civo-color-text)]">
                        {source.lastCheckedAt ? formatRelativeTime(new Date(source.lastCheckedAt)) : "Noch nie"}
                    </dd>
                </div>
                <div>
                    <dt className="text-[var(--civo-color-text-muted)]">Mapping</dt>
                    <dd className="text-[var(--civo-color-text)]">{source.mapping ? "Konfiguriert" : "Nicht konfiguriert"}</dd>
                </div>
            </dl>

            {source.status === "ERROR" && source.lastError && (
                <p className="rounded-[var(--civo-radius)] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                    {source.lastError}
                </p>
            )}
            {testMessage && <p className="text-sm text-[var(--civo-color-text)]">{testMessage}</p>}

            <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleTestConnection} disabled={isPending}>
                    {isPending ? "Prüft…" : "Verbindung testen"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onEdit} disabled={isPending}>
                    Bearbeiten
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={handleDelete} disabled={isPending}>
                    Entfernen
                </Button>
            </div>

            <DataSourceMappingPanel websiteId={websiteId} dataSourceId={source.id} dataset={source.dataset} />
        </div>
    );
}

function DataSourceForm({
    websiteId,
    dataset,
    existing,
    onCancel,
    onSaved,
}: {
    websiteId: string;
    dataset: DataSourceDataset;
    existing: DataSourceRow | null;
    onCancel?: () => void;
    onSaved: () => void;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const existingConfig = (existing?.config ?? {}) as { baseUrl?: string; authMode?: AuthMode };
    const [name, setName] = useState(existing?.name ?? "");
    const [baseUrl, setBaseUrl] = useState(existingConfig.baseUrl ?? "");
    const [authMode, setAuthMode] = useState<AuthMode>(existingConfig.authMode ?? "NONE");

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);

        startTransition(async () => {
            const result = await upsertDataSourceAction({
                websiteId,
                name,
                kind: "REST" satisfies DataSourceKind,
                dataset,
                config: { baseUrl, authMode },
            });

            if (!result.ok) {
                setError(result.message);
                return;
            }

            onSaved();
            router.refresh();
        });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label htmlFor={`name-${dataset}`}>Name</Label>
                    <Input
                        id={`name-${dataset}`}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="z. B. Kommunales Veranstaltungsportal"
                        required
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor={`authMode-${dataset}`}>Authentifizierung</Label>
                    <select
                        id={`authMode-${dataset}`}
                        value={authMode}
                        onChange={(e) => setAuthMode(e.target.value as AuthMode)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <option value="NONE">Keine</option>
                        <option value="API_KEY">API-Schlüssel</option>
                        <option value="BEARER_TOKEN">Bearer-Token</option>
                    </select>
                </div>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor={`baseUrl-${dataset}`}>URL</Label>
                <Input
                    id={`baseUrl-${dataset}`}
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://beispiel-kommune.de/api/veranstaltungen"
                    required
                />
            </div>

            {authMode !== "NONE" && (
                <p className="text-xs text-[var(--civo-color-text-muted)]">
                    Das Zugangs-Credential wird nicht hier gespeichert, sondern muss serverseitig als
                    Umgebungsvariable hinterlegt werden. Wenden Sie sich dazu an Ihren Administrator.
                </p>
            )}

            {error && <p className="text-sm text-red-700">{error}</p>}

            <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isPending}>
                    {isPending ? "Speichert…" : "Speichern"}
                </Button>
                {onCancel && (
                    <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
                        Abbrechen
                    </Button>
                )}
            </div>
        </form>
    );
}
