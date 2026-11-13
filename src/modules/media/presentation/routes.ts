/**
 * Admin routes of the module, in one place so actions (cache invalidation) and components
 * (navigation) cannot drift apart.
 */
export const mediaRoutes = {
  library: (websiteId: string) => `/websites/${websiteId}/media`,
} as const;
