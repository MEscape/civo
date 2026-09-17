import { notFound } from "next/navigation";
import { websiteService } from "@/modules/website/infrastructure/website-service";
import { pageService } from "@/modules/builder/infrastructure/page-service";
import { BuilderStoreProvider } from "@/modules/builder/application/builder-store-provider";
import { BuilderShell } from "@/modules/builder/components/builder-shell";
import { toDomainTheme } from "@/modules/website/domain/theme";
import "@/modules/component-platform/infrastructure/registry";

/**
 * The builder route. Server Component: loads and validates the website
 * and its home page's config, then hands a plain, serializable snapshot
 * to the client builder shell. The builder itself is a Client Component
 * (it needs Redux, dnd-kit, and interactive selection) — but loading the
 * initial data stays server-side per spec §14.
 */
export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const websiteResult = await websiteService.getById(id);
    if (!websiteResult.ok) notFound();

    const pageResult = await pageService.getByWebsiteAndPath(id, "");
    if (!pageResult.ok) notFound();

    const configResult = await pageService.getValidatedConfig(pageResult.data);
    if (!configResult.ok) notFound();

    const theme = toDomainTheme(websiteResult.data.theme);

    return (
        <BuilderStoreProvider>
            <BuilderShell
                website={{ id: websiteResult.data.id, name: websiteResult.data.name, theme }}
                page={{ id: pageResult.data.id, title: pageResult.data.title }}
                initialChildren={configResult.data.children}
            />
        </BuilderStoreProvider>
    );
}
