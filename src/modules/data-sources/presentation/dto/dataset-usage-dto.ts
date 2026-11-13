/** A place that shows a dataset, as the screen links to it. */
export interface DatasetUse {
  /** The page's title, or the saved map's name. */
  readonly title: string;
  /** Where it is changed: the page's editor, the map's editor, or publishing for the live site. */
  readonly href: string;
  /** The components on a draft page that read the dataset, each opening the editor with it selected. */
  readonly components: ReadonlyArray<{ readonly label: string; readonly href: string }>;
  /**
   * `draft`: a page in the editor. `live`: a page of the live site, which shows the dataset until
   * the next publish (`components` is empty). `map`: a saved map with a layer of the dataset, placed
   * on a page or not (`components` is empty).
   */
  readonly where: 'draft' | 'live' | 'map';
}

/** A component on a page that still shows sample data, opening the editor with it selected. */
export interface ComponentAwaitingData {
  readonly label: string;
  readonly page: string;
  /** The content kind it asks for; a dataset of this kind can go there. */
  readonly kind: string;
  readonly href: string;
}

/**
 * The places that use each dataset, by dataset id, read by the route from the
 * builder, the maps and the live release; `null` when they could not be read,
 * so "unused" is never guessed.
 */
export type DatasetUsage = Readonly<Record<string, readonly DatasetUse[]>> | null;
