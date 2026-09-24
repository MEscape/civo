import { notFound } from "next/navigation";
import { websiteService } from "@/modules/website/application/website-service";
import { ThemeSettingsForm } from "@/modules/website/components/theme-settings-form";
import { toDomainTheme } from "@/modules/website/domain/theme";
import { dataSourceService } from "@/modules/data-sources/application/data-source-service";
import { DataSourcesPanel } from "@/modules/data-sources/components/data-sources-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { ToolbarLink } from "@/components/ui/toolbar-link";
import { ArrowLeft, ExternalLink } from "@/components/ui/icons";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const websiteResult = await websiteService.getById(id);
    if (!websiteResult.ok) notFound();

    const theme = toDomainTheme(websiteResult.data.theme);
    const themeId = websiteResult.data.theme?.id || "";

    const dataSourcesResult = await dataSourceService.listForWebsite(id);
    const dataSources = dataSourcesResult.ok ? dataSourcesResult.data : [];

    return (
        <div className="flex h-app-body flex-col">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border bg-surface px-4 py-2">
                <nav aria-label="Brotkrumen" className="flex min-w-0 items-center gap-2 text-sm">
                    <Link
                        href="/websites"
                        className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1.5 rounded-token-sm text-copy-muted hover:text-copy pointer-coarse:h-11 pointer-coarse:min-w-11"
                    >
                        <ArrowLeft className="size-4" />
                        <span className="sr-only sm:not-sr-only">Websites</span>
                    </Link>
                    <span aria-hidden="true" className="text-border-strong">/</span>
                    <Link
                        href={`/websites/${id}/builder`}
                        className="inline-flex h-8 min-w-0 items-center text-copy-muted hover:text-copy pointer-coarse:h-11"
                    >
                        <span className="truncate">{websiteResult.data.name}</span>
                    </Link>
                    <span aria-hidden="true" className="text-border-strong">/</span>
                    <span aria-current="page" className="shrink-0 font-medium text-copy">Einstellungen</span>
                </nav>

                <ToolbarLink
                    href={`/s/${websiteResult.data.id}`}
                    label="Öffentliche Seite"
                    icon={<ExternalLink className="size-4" />}
                    newTab
                />
            </div>

            {/* Not <main>: the dashboard layout already provides the page's one main landmark. */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-canvas p-4 md:p-8">
                <div className="mx-auto max-w-6xl">
                    <h1 className="sr-only">Einstellungen für {websiteResult.data.name}</h1>
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
            </div>
        </div>
    );
}
