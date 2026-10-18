/**
 * Admin routes of the module, in one place so actions (cache invalidation)
 * and components (navigation) cannot drift apart. The builder has no public
 * route: published pages are served from release snapshots, so saving a
 * draft never invalidates anything public.
 */
export const builderRoutes = {
  /**
   * The layout every builder page sits under. What the builder saves changes what
   * that layout shows (whether the editor differs from the live site), so saving
   * marks it stale.
   */
  websiteLayout: '/websites/[websiteId]',
  pages: (websiteId: string) => `/websites/${websiteId}/builder`,
  editor: (websiteId: string, pageId: string) => `/websites/${websiteId}/builder/${pageId}`,
  /** The editor with one component selected and scrolled to, e.g. from "used on" links. */
  component: (websiteId: string, pageId: string, nodeId: string) =>
    `/websites/${websiteId}/builder/${pageId}?select=${encodeURIComponent(nodeId)}`,
} as const;
