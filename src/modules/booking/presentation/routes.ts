/**
 * Admin routes of the module, in one place so actions (cache invalidation)
 * and components (navigation) cannot drift apart.
 */
export const bookingRoutes = {
  admin: (websiteId: string) => `/websites/${websiteId}/bookings`,
  /** The website's users with the invitation form already set to the employee role: the one that gets a calendar in the team. */
  inviteEmployee: (websiteId: string) => `/websites/${websiteId}/users?invite=employee`,
  /** One location's workspace: its hours, services and rooms. */
  location: (websiteId: string, locationId: string) =>
    `/websites/${websiteId}/bookings/locations/${locationId}`,
  /**
   * A published website's home, which the emails lead back to. The site is
   * served by the app under `s/<slug>` (the release module owns that route);
   * the booking opens on whichever of its pages holds it, see `manage`.
   */
  publicSite: (siteSlug: string) => `/s/${siteSlug}`,
} as const;
