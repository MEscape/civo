import { notFound } from "next/navigation";
import { websiteService } from "@/modules/website/infrastructure/website-service";
import { ThemeSettingsForm } from "@/modules/website/components/theme-settings-form";
import { toDomainTheme } from "@/modules/website/domain/theme";
import { dataSourceService } from "@/modules/data-sources/infrastructure/data-source-service";
import { DataSourcesPanel } from "@/modules/data-sources/components/data-sources-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const websiteResult = await websiteService.getById(id);
    if (!websiteResult.ok) notFound();

    const theme = toDomainTheme(websiteResult.data.theme);
    const themeId = websiteResult.data.theme?.id || "";

    const dataSourcesResult = await dataSourceService.listForWebsite(id);
    const dataSources = dataSourcesResult.ok ? dataSourcesResult.data : [];

    return (
        <div className="flex h-[calc(100vh-3.5rem)] flex-col">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--civo-color-border)] bg-[var(--civo-color-surface)] px-4">
                <div className="flex items-center gap-2 text-sm">
                    <Link href="/websites" className="text-[var(--civo-color-text-muted)] hover:underline">
                        ← Websites
                    </Link>
                    <span className="text-[var(--civo-color-border)]">/</span>
                    <Link href={`/websites/${id}/builder`} className="text-[var(--civo-color-text-muted)] hover:underline">
                        {websiteResult.data.name}
                    </Link>
                    <span className="text-[var(--civo-color-border)]">/</span>
                    <span className="font-medium text-[var(--civo-color-text)]">Einstellungen</span>
                </div>

                <Link
                    href={`/s/${websiteResult.data.id}`}
                    target="_blank"
                    className="text-sm text-[var(--civo-color-text-muted)] hover:underline"
                >
                    Öffentliche Seite
                </Link>
            </div>

            <main className="flex-1 overflow-y-auto bg-[var(--civo-color-background)] p-6 md:p-8">
                <div className="mx-auto max-w-6xl">
                    <Tabs defaultValue="theme">
                        <TabsList>
                            <TabsTrigger value="theme">Theme</TabsTrigger>
                            <TabsTrigger value="data-sources">Datenquellen</TabsTrigger>
                        </TabsList>
                        <TabsContent value="theme">
                            <ThemeSettingsForm
                                websiteId={websiteResult.data.id}
                                themeId={themeId}
                                initialTheme={theme}
                            />
                        </TabsContent>
                        <TabsContent value="data-sources">
                            <DataSourcesPanel websiteId={websiteResult.data.id} initialSources={dataSources} />
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </div>
    );
}
