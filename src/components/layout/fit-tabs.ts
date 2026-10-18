export interface TabMeasures {
  /** The width of each tab, in order. */
  readonly tabs: readonly number[];
  /** The space between two items of the bar. */
  readonly gap: number;
  /** The width of the trailing group's button (administration), or 0 when there is none. */
  readonly group: number;
  /** The width of the "more" button that takes what does not fit. */
  readonly more: number;
}

/**
 * How many tabs fit in `available` pixels, in order: all of them beside the
 * group's button when they can, else as many as fit beside the "more"
 * button, which then holds the rest and the group's links.
 */
export function fitTabs(available: number, measures: TabMeasures): number {
  const { tabs, gap, group, more } = measures;
  const widthOf = (count: number) =>
    tabs.slice(0, count).reduce((sum, width) => sum + width, 0) + gap * count;

  if (widthOf(tabs.length) + group <= available) {
    return tabs.length;
  }
  let count = tabs.length - 1;
  while (count > 0 && widthOf(count) + more > available) {
    count -= 1;
  }
  return count;
}
