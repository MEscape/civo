/** A page that places a map, as the screens link to it. */
export interface MapUse {
  /** The page's title, and its editor. */
  readonly title: string;
  readonly href: string;
  /** The map components on it, each opening the editor with it selected. */
  readonly components: ReadonlyArray<{ readonly label: string; readonly href: string }>;
  /**
   * A page of the live site rather than a draft: it shows the map until the next publish, so
   * `href` leads to publishing and `components` is empty.
   */
  readonly isLive: boolean;
}

/** A map component on a page with no map chosen yet, opening the editor with it selected. */
export interface MapAwaiting {
  readonly label: string;
  readonly page: string;
  readonly href: string;
}

/** The pages placing each map, by map id; `null` when unknown, so no map is called unused by guess. */
export type MapUsage = Readonly<Record<string, readonly MapUse[]>> | null;
