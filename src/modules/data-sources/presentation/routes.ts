/**
 * Admin pages whose data a mutation here changes, so the actions can refresh
 * them. These URLs are OWNED by `website` (settings) and `builder` (pages);
 * they are repeated here only because data-sources is the lowest module in
 * the dependency graph and cannot import its dependants without a cycle.
 * `__tests__/src/modules/routes-consistency.test.ts` fails if they drift.
 */
export const dataSourceRoutes = {
  settings: (websiteId: string) => `/websites/${websiteId}/settings`,
  builder: (websiteId: string) => `/websites/${websiteId}/builder`,
} as const;
