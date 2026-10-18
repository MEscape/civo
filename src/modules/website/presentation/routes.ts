/**
 * Admin routes of the module, in one place so actions (cache invalidation)
 * and components (navigation) cannot drift apart. If the public site is
 * cached by path, add its route here and revalidate it in the actions.
 */
export const websiteRoutes = {
  list: () => '/websites',
  detail: (id: string) => `/websites/${id}`,
  settings: (id: string) => `/websites/${id}/settings`,
  /** The members and invitations of the tenant, shown among the website's sections. */
  users: (id: string) => `/websites/${id}/users`,
  /** What was done on the website and by whom, recorded by every module. */
  audit: (id: string) => `/websites/${id}/audit`,
  /** What was done on every website, for the platform's administrators. */
  platformAudit: () => '/websites/audit',
  /** Everyone with an account across all websites, for the platform's administrators. */
  platformUsers: () => '/websites/users',
} as const;
