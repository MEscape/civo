/** Destinations in other modules; the route computes them so the builder never imports those modules. */
export interface EditorLinks {
  /** The page list, one level above the page being edited. */
  readonly pages: string;
  readonly publicSite: string;
}
