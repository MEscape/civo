import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { websiteService } from "@/modules/website/application/website-service";
import { pageService } from "@/modules/builder/application/page-service";
import { PageRenderer } from "@/modules/website/components/page-renderer";
import { ThemeProvider } from "@/modules/website/components/theme-provider";
import { toDomainTheme } from "@/modules/website/domain/theme";

/**
 * Public website home page. Fully server-rendered: the theme, page
 * lookup, and validated config all happen server-side, and PageRenderer
 * itself is a Server Component — no client JavaScript is required to
 * render a published municipal page (spec §14, §38).
 *
 * Route: /site/[websiteId] — the MVP identifies a website by its
 * internal id here rather than a custom domain (custom domains are
 * explicitly out of scope, spec §43). Swapping this for a domain-based
 * router later only changes how `websiteId` is resolved, not anything
 * below this line.
 */
// NOTE on routing: Moved from (site) to s/ to avoid sibling route group collisions.
export default async function PublicWebsitePage({
                                                    params,
                                                }: {
    params: Promise<{ siteSlug: string }>;
}) {
    const { siteSlug } = await params;

    const websiteResult = await websiteService.getById(siteSlug);
    if (!websiteResult.ok) notFound();

    const pageResult = await pageService.getByWebsiteAndPath(siteSlug, "");
    if (!pageResult.ok) notFound();

    const configResult = await pageService.getValidatedConfig(pageResult.data);
    if (!configResult.ok) notFound();

    const theme = toDomainTheme(websiteResult.data.theme);

    return (
        <ThemeProvider theme={theme}>
            {/* The public site has no dashboard layout above it, so it owns the page's main landmark. */}
            <main>
                <PageRenderer config={configResult.data} websiteId={websiteResult.data.id} />
            </main>
        </ThemeProvider>
    );
}

export async function generateMetadata({
                                           params,
                                       }: {
    params: Promise<{ siteSlug: string }>;
}): Promise<Metadata> {
    const { siteSlug } = await params;
    const websiteResult = await websiteService.getById(siteSlug);
    if (!websiteResult.ok) return {};
    return {
        title: websiteResult.data.name,
        description: websiteResult.data.description ?? undefined,
    };
}
