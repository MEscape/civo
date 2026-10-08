/**
 * Admin routes of the module, in one place so actions (cache invalidation)
 * and components (navigation) cannot drift apart. The builder has no public
 * route: published pages are served from release snapshots, so saving a
 * draft never invalidates anything public.
 */
export const builderRoutes = {
  pages: (websiteId: string) => `/websites/${websiteId}/builder`,
  editor: (websiteId: string, pageId: string) => `/websites/${websiteId}/builder/${pageId}`,
} as const;
