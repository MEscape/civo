"use server";

import type { ReactNode } from "react";
import { pageConfigSchema } from "@/modules/builder/domain/page-schema";
import { renderPageNodes } from "@/modules/component-platform/infrastructure/render-nodes";

export type CanvasRenderResult =
    | { ok: true; node: ReactNode }
    | { ok: false; message: string };

/**
 * Server-renders the CURRENT DRAFT page tree using the exact same
 * `renderPageNodes`/component registry the public PageRenderer uses
 * (with `editMode: true`, adding only a `data-civo-node-id` marker per
 * node — see render-nodes.tsx), and returns the resulting React element
 * tree directly to the client as a Server Action result.
 *
 * This is the framework-native mechanism for this problem. An earlier
 * version of this function called `react-dom/server`'s
 * `renderToStaticMarkup` manually and returned an HTML string — Next.js
 * 16's bundler hard-rejects that at build time in BOTH Server Actions
 * and Route Handlers ("You're importing a component that imports
 * react-dom/server... render or return the content directly as a Server
 * Component instead").
 *
 * Returning the React element tree itself (the RSC payload) is exactly
 * what that error message is asking for, and avoids the client needing
 * to invoke `dangerouslySetInnerHTML`, so async Server Components work
 * correctly without a second manually-invoked renderer.
 *
 * `websiteId` (spec §30–31) is passed through so data-aware components
 * preview against THIS website's configured data source (falling back to
 * demo/mock data when none is configured — see the civic/smartcity
 * provider resolvers) rather than a single global provider, keeping the
 * builder preview and the public render path consistent.
 */
export async function renderCanvasAction(config: unknown, websiteId?: string): Promise<CanvasRenderResult> {
    const parsed = pageConfigSchema.safeParse(config);
    if (!parsed.success) {
        return { ok: false, message: "Die aktuelle Seitenkonfiguration ist ungültig." };
    }

    return { ok: true, node: renderPageNodes(parsed.data.children, true, websiteId) };
}
