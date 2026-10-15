import type { RequirementCoverageView } from '../../application/contracts/setup-views';

/** The condition that removed the last candidate of a requirement, in the order the engine applies them. */
export type ShortfallReason = 'no-type' | 'no-skills' | 'no-location' | 'no-pool' | 'too-few';

/**
 * Names the first condition that leaves too few resources, from how the
 * candidates narrowed down (type, then capabilities, then location, then the
 * pinned pool). `null` when enough qualify.
 */
export function shortfallReasonOf(coverage: RequirementCoverageView): ShortfallReason | null {
  const { funnel, needed } = coverage;
  if (funnel.inPool >= needed) {
    return null;
  }
  if (funnel.ofType === 0) {
    return 'no-type';
  }
  if (funnel.withSkills === 0) {
    return 'no-skills';
  }
  if (funnel.atLocation === 0) {
    return 'no-location';
  }
  if (funnel.inPool === 0) {
    return 'no-pool';
  }
  return 'too-few';
}
