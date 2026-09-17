import Link from "next/link";
import { websiteService } from "@/modules/website/infrastructure/website-service";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/layout-primitives";

export const dynamic = "force-dynamic"; // dashboard always reflects latest DB state

export default async function WebsitesPage() {
    const result = await websiteService.list();

    return (
        <Container className="py-10">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="font-[family-name:var(--civo-font-heading)] text-2xl text-[var(--civo-color-text)]">
                        Websites
                    </h1>
                    <p className="mt-1 text-sm text-[var(--civo-color-text-muted)]">
                        Kommunale, Smart-City und Vereins-Websites, die auf dieser Plattform verwaltet werden.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/websites/new">Neue Website</Link>
                </Button>
            </div>

            {!result.ok && (
                <div className="rounded-[var(--civo-radius)] border border-[var(--civo-color-border)] bg-[var(--civo-color-surface)] p-6 text-sm text-[var(--civo-color-text-muted)]">
                    Websites konnten nicht geladen werden. Stellen Sie sicher, dass die Datenbank läuft und migriert wurde (siehe README).
                </div>
            )}

            {result.ok && result.data.length === 0 && (
                <div className="rounded-[var(--civo-radius)] border border-dashed border-[var(--civo-color-border)] p-10 text-center">
                    <p className="text-sm text-[var(--civo-color-text-muted)]">
                        Noch keine Websites vorhanden. Erstellen Sie die erste, um zu beginnen.
                    </p>
                </div>
            )}

            {result.ok && result.data.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {result.data.map((website) => (
                        <Card key={website.id} className="h-full flex-1 flex flex-col">
                            <CardHeader className="flex-1 flex flex-col">
                                <CardTitle>{website.name}</CardTitle>
                                <CardDescription>
                                    {website.description || `/${website.slug}`}
                                </CardDescription>
                                {website.templateKey && (
                                    <p className="mt-2 inline-block w-fit rounded-full bg-[var(--civo-color-background)] px-2.5 py-1 text-xs text-[var(--civo-color-text-muted)]">
                                        {website.templateKey}
                                    </p>
                                )}
                                <div className="mt-auto pt-4 flex items-center gap-2">
                                    <Button asChild size="sm" variant="outline">
                                        <Link href={`/websites/${website.id}/builder`}>Builder</Link>
                                    </Button>
                                    <Button asChild size="sm" variant="outline">
                                        <Link href={`/websites/${website.id}/municipality-editor`}>Gemeindeverwaltung</Link>
                                    </Button>
                                </div>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            )}
        </Container>
    );
}
