import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { releaseService } from "@/modules/release/application/release-service";
import { PageRenderer } from "@/modules/website/components/page-renderer";
import { ThemeProvider } from "@/modules/website/components/theme-provider";
import { toDomainTheme } from "@/modules/website/domain/theme";

/**
 * Public website home page. Fully server-rendered: the release lookup and
 * rendering all happen server-side, and PageRenderer itself is a Server
 * Component — no client JavaScript is required to render a published
 * municipal page (spec §14, §38).
 *
 * Resolves through the website's currently PUBLISHED WebsiteRelease
 * snapshot — never through live Page/PageConfig rows (Phase 4 Rule 2).
 * A website that exists but has never been published, or whose draft has
 * unpublished changes, 404s here exactly like one that doesn't exist:
 * public visibility is controlled entirely by releaseService.publish,
 * not by what the builder currently holds.
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
    const { siteSlug: websiteId } = await params;

    const snapshotResult = await releaseService.getPublishedSnapshot(websiteId);
    if (!snapshotResult.ok) notFound();
    const snapshot = snapshotResult.data;

    // The MVP only serves a website's home page (path ""); the existing
    // pageService equivalent (getByWebsiteAndPath) had the same
    // limitation, so this preserves prior behavior rather than narrowing
    // it — a page-tree router over the rest of snapshot.pages is future
    // work, not a regression introduced here.
    const homePage = snapshot.pages.find((page) => page.path === "");
    if (!homePage) notFound();

    const theme = toDomainTheme(snapshot.theme);

    return (
        <ThemeProvider theme={theme}>
            {/* The public site has no dashboard layout above it, so it owns the page's main landmark. */}
            <main>
                <PageRenderer config={homePage.config} />
            </main>
        </ThemeProvider>
    );
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ siteSlug: string }>;
}): Promise<Metadata> {
    const { siteSlug: websiteId } = await params;
    const snapshotResult = await releaseService.getPublishedSnapshot(websiteId);
    if (!snapshotResult.ok) return {};
    return {
        title: snapshotResult.data.website.name,
        description: snapshotResult.data.website.description ?? undefined,
    };
}
