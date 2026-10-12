/**
 * How much of a dataset a component shows at once. A news grid shows a page
 * of cards; a map shows every feature and a chart one row per point, so those
 * kinds read a whole dataset. A kind declares its scale where the kind is
 * defined, and nowhere else decides it.
 */
export const LIST_SCALES = ['cards', 'dataset'] as const;
export type ListScale = (typeof LIST_SCALES)[number];

export interface ListBounds {
  readonly min: number;
  readonly max: number;
  /** What a list shows until an editor sets the Limit. */
  readonly initial: number;
}

/**
 * The bounds of the Limit an editor can set in the builder, and the backstop
 * for a request that bypasses it. The one definition: component props, the
 * properties panel and the use case all read it.
 */
export const LIST_LIMITS = {
  cards: { min: 1, max: 100, initial: 12 },
  dataset: { min: 1, max: 1_000, initial: 500 },
} as const satisfies Record<ListScale, ListBounds>;

/** Furthest a window may be moved from the start of a dataset. */
export const MAX_LIST_OFFSET = 100_000;
