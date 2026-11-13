export const mapRoutes = {
  list: (websiteId: string) => `/websites/${encodeURIComponent(websiteId)}/maps`,
  create: (websiteId: string) => `/websites/${encodeURIComponent(websiteId)}/maps/new`,
  edit: (websiteId: string, mapId: string) =>
    `/websites/${encodeURIComponent(websiteId)}/maps/${encodeURIComponent(mapId)}`,
} as const;
