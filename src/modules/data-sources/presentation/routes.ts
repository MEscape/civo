/**
 * Admin pages whose data a mutation here changes, so the actions can refresh
 * them. `sources` is this module's own screen. `builder` is OWNED by the
 * builder module; it is repeated here only because data-sources is the
 * lowest module in the dependency graph and cannot import its dependants
 * without a cycle.
 */
export const dataSourceRoutes = {
  sources: (websiteId: string) => `/websites/${websiteId}/data`,
  source: (websiteId: string, sourceId: string) => `/websites/${websiteId}/data/${sourceId}`,
  sourceNew: (websiteId: string) => `/websites/${websiteId}/data/new`,
  sourceEdit: (websiteId: string, sourceId: string) =>
    `/websites/${websiteId}/data/${sourceId}/edit`,
  datasetNew: (websiteId: string, sourceId: string) =>
    `/websites/${websiteId}/data/${sourceId}/datasets/new`,
  datasetEdit: (websiteId: string, sourceId: string, datasetId: string) =>
    `/websites/${websiteId}/data/${sourceId}/datasets/${datasetId}/edit`,
  datasetMapping: (websiteId: string, sourceId: string, datasetId: string) =>
    `/websites/${websiteId}/data/${sourceId}/datasets/${datasetId}/mapping`,
  builder: (websiteId: string) => `/websites/${websiteId}/builder`,
} as const;
