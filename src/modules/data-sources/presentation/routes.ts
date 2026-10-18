/**
 * Admin pages whose data a mutation here changes, so the actions can refresh
 * them. `sources` is this module's own screen. `builder` is OWNED by the
 * builder module; it is repeated here only because data-sources is the
 * lowest module in the dependency graph and cannot import its dependants
 * without a cycle.
 */
export const dataSourceRoutes = {
  sources: (websiteId: string) => `/websites/${websiteId}/data`,
  builder: (websiteId: string) => `/websites/${websiteId}/builder`,
} as const;
