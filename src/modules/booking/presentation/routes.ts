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
} as const;
