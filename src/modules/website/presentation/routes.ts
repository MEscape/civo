/**
 * Admin routes of the module, in one place so actions (cache invalidation)
 * and components (navigation) cannot drift apart. If the public site is
 * cached by path, add its route here and revalidate it in the actions.
 */
export const websiteRoutes = {
  list: () => '/websites',
  detail: (id: string) => `/websites/${id}`,
  settings: (id: string) => `/websites/${id}/settings`,
} as const;
