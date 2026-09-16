import Link from "next/link";
import { websiteService } from "@/modules/website/infrastructure/website-service";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Container } from "@/modules/builder/components/layout/layout-primitives";

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
                        Municipal, smart-city, and Verein websites managed on this platform.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/websites/new">Neue Website</Link>
                </Button>
            </div>

            {!result.ok && (
                <div className="rounded-[var(--civo-radius)] border border-[var(--civo-color-border)] bg-[var(--civo-color-surface)] p-6 text-sm text-[var(--civo-color-text-muted)]">
                    Websites could not be loaded. Make sure the database is running and migrated (see README).
                </div>
            )}

            {result.ok && result.data.length === 0 && (
                <div className="rounded-[var(--civo-radius)] border border-dashed border-[var(--civo-color-border)] p-10 text-center">
                    <p className="text-sm text-[var(--civo-color-text-muted)]">
                        No websites yet. Create the first one to get started.
                    </p>
                </div>
            )}

            {result.ok && result.data.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {result.data.map((website) => (
                        <Link key={website.id} href={`/websites/${website.id}/builder`}>
                            <Card className="h-full transition-colors hover:border-[var(--civo-color-primary)]">
                                <CardHeader>
                                    <CardTitle>{website.name}</CardTitle>
                                    <CardDescription>
                                        {website.description || `/${website.slug}`}
                                    </CardDescription>
                                    {website.templateKey && (
                                        <p className="mt-3 inline-block w-fit rounded-full bg-[var(--civo-color-background)] px-2.5 py-1 text-xs text-[var(--civo-color-text-muted)]">
                                            {website.templateKey}
                                        </p>
                                    )}
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </Container>
    );
}
