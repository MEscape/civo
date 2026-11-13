import type { SectionDensity } from '@components/layout/layout-primitives';

/** Compact, task-sized blocks: they sit closer to their neighbours. */
const TIGHT_KINDS: ReadonlySet<string> = new Set([
  'openingHours',
  'contactCard',
  'accordion',
  'tabs',
]);
/** The blocks that open and close a page get room. */
const AIRY_KINDS: ReadonlySet<string> = new Set(['hero', 'callToAction']);
/** No more than this many neighbours in a row share one density. */
const MAX_RUN = 2;

function wantedDensity(kind: string): SectionDensity {
  if (AIRY_KINDS.has(kind)) {
    return 'airy';
  }
  return TIGHT_KINDS.has(kind) ? 'tight' : 'default';
}

/**
 * One density per entry, in page order. A `null` entry is a node that is
 * not rendered (hidden, unregistered): it gets `default` and does not count
 * towards a run. A third neighbour of the same density falls back to
 * `default`, so a page never has more than two equally spaced blocks in a row.
 */
export function densitiesFor(kinds: ReadonlyArray<string | null>): SectionDensity[] {
  const placed: SectionDensity[] = [];
  const result: SectionDensity[] = [];

  for (const kind of kinds) {
    if (kind === null) {
      result.push('default');
      continue;
    }
    const wanted = wantedDensity(kind);
    const recent = placed.slice(-MAX_RUN);
    const isRun =
      wanted !== 'default' &&
      recent.length === MAX_RUN &&
      recent.every((density) => density === wanted);
    const density = isRun ? 'default' : wanted;
    placed.push(density);
    result.push(density);
  }

  return result;
}
