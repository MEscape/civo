/**
 * Admin routes of the module, in one place so actions (cache invalidation)
 * and components (navigation) cannot drift apart.
 */
export const bookingRoutes = {
  admin: (websiteId: string) => `/websites/${websiteId}/bookings`,
} as const;
