"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    createDataSourceAction,
    deleteDataSourceAction,
    testDataSourceConnectionAction,
} from "@/modules/data-sources/application/data-source-actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DataSourceStatusBadge } from "@/modules/data-sources/components/data-source-status-badge";
import { DatasetManagementPanel } from "@/modules/data-sources/components/dataset-management-panel";
import { formatRelativeTime } from "@/lib/utils/formatters";
import { describeConnectionFailure } from "@/modules/data-sources/components/describe-connection-failure";
import type { AuthMode, DataSourceKind, DataSourceView } from "@/modules/data-sources/domain/data-source-schema";

type DataSourcesPanelProps = {
    websiteId: string;
    initialSources: DataSourceView[];
};

export function DataSourcesPanel({ websiteId, initialSources }: DataSourcesPanelProps) {
    const [isCreating, setIsCreating] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-[var(--civo-color-text)]">Datenquellen</h2>
                    <p className="mt-1 text-sm text-[var(--civo-color-text-muted)]">
                        Verbinden Sie kommunale und Smart-City-Datenquellen, um Ihren Website-Komponenten echte Daten
                        zur Verfügung zu stellen.
                    </p>
                </div>
                <Button onClick={() => setIsCreating(true)} disabled={isCreating}>
                    + Neue Quelle
                </Button>
            </div>

            {isCreating && (
                <Card>
                    <CardHeader>
                        <CardTitle>Neue Datenquelle anlegen</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataSourceForm
                            websiteId={websiteId}
                            onCancel={() => setIsCreating(false)}
                            onSaved={() => setIsCreating(false)}
                        />
                    </CardContent>
                </Card>
            )}

            {initialSources.map((source) => (
                <ConfiguredSourceCard
                    key={source.id}
                    websiteId={websiteId}
                    source={source}
                />
            ))}
            
            {initialSources.length === 0 && !isCreating && (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-[var(--civo-color-text-muted)]">
                    Keine Datenquellen konfiguriert. Es werden Beispieldaten angezeigt.
                </div>
            )}
        </div>
    );
}

function ConfiguredSourceCard({
    websiteId,
    source,
}: {
    websiteId: string;
    source: DataSourceView;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [testMessage, setTestMessage] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

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
        if (!window.confirm("Diese Datenquelle wirklich entfernen? Alle Datensätze dieser Quelle werden ebenfalls gelöscht.")) {
            return;
        }
        setDeleteError(null);
        startTransition(async () => {
            const result = await deleteDataSourceAction(source.id, websiteId);
            if (!result.ok) {
                setDeleteError(result.message);
                return;
            }
            router.refresh();
        });
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <div>
                    <CardTitle>{source.name}</CardTitle>
                    <CardDescription className="mt-1">
                        {config.baseUrl ?? "Unbekannte URL"}
                    </CardDescription>
                </div>
                <DataSourceStatusBadge status={source.status} />
            </CardHeader>
            <CardContent className="space-y-6 border-t pt-4">
                <div className="space-y-4">
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-[var(--civo-color-text-muted)]">Typ</dt>
                            <dd className="text-[var(--civo-color-text)]">{source.kind === "REST" ? "REST / JSON" : "Mock (Beispieldaten)"}</dd>
                        </div>
                        <div>
                            <dt className="text-[var(--civo-color-text-muted)]">Zuletzt geprüft</dt>
                            <dd className="text-[var(--civo-color-text)]">
                                {source.lastCheckedAt ? formatRelativeTime(new Date(source.lastCheckedAt)) : "Noch nie"}
                            </dd>
                        </div>
                    </dl>

                    {source.status === "ERROR" && source.lastError && (
                        <p className="rounded-[var(--civo-radius)] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                            {source.lastError}
                        </p>
                    )}
                    {testMessage && <p className="text-sm text-[var(--civo-color-text)]">{testMessage}</p>}
                    {deleteError && <p className="text-sm text-red-700">{deleteError}</p>}

                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleTestConnection} disabled={isPending}>
                            {isPending ? "Prüft…" : "Verbindung testen"}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={handleDelete} disabled={isPending}>
                            Entfernen
                        </Button>
                    </div>
                </div>

                <DatasetManagementPanel websiteId={websiteId} dataSource={source} initialDatasets={source.datasets ?? []} />
            </CardContent>
        </Card>
    );
}

function DataSourceForm({
    websiteId,
    onCancel,
    onSaved,
}: {
    websiteId: string;
    onCancel: () => void;
    onSaved: () => void;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState("");
    const [baseUrl, setBaseUrl] = useState("");
    const [authMode, setAuthMode] = useState<AuthMode>("NONE");

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);

        startTransition(async () => {
            const result = await createDataSourceAction({
                websiteId,
                name,
                kind: "REST" satisfies DataSourceKind,
                config: { baseUrl, authMode },
            });

            if (!result.ok) {
                setError(result.message);
                return;
            }

            router.refresh();
            onSaved();
        });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label htmlFor="name">Name der Quelle</Label>
                    <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="z. B. Kommunales Open-Data-Portal"
                        required
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="authMode">Authentifizierung</Label>
                    <select
                        id="authMode"
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
                <Label htmlFor="baseUrl">API Basis-URL</Label>
                <Input
                    id="baseUrl"
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://beispiel-kommune.de/api"
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
                <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
                    Abbrechen
                </Button>
            </div>
        </form>
    );
}
