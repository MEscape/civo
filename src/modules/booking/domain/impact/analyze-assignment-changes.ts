import { assessEligibility } from '../assignment/assignment-eligibility';
import { findOpenUnit, holdsUnitOf, NO_UNIT, planRelease } from '../assignment/booking-assignment';

import { requireStatus } from './impact-findings';

import type { Findings } from './impact-findings';
import type { ImpactContext, ProposedChange } from './impact-types';

/** Giving an open unit to somebody: is the requirement real, is the candidate eligible, is a unit open? */
export function analyzeAssign(
  context: ImpactContext,
  change: Extract<ProposedChange, { kind: 'assign' }>,
  findings: Findings,
): void {
  const { booking, requirementIndex, candidate } = change;
  if (!requireStatus(findings, booking, 'assign')) {
    return;
  }
  const requirement = context.service.requirements[requirementIndex];
  if (requirement === undefined) {
    findings.violations.push({ code: 'requirement-unknown' });
    return;
  }
  if (candidate === null) {
    findings.unchecked.push('eligibility');
  } else {
    const assessment = assessEligibility({
      booking,
      requirement,
      requirementIndex,
      candidate,
      now: context.now,
    });
    if (assessment.kind === 'ineligible') {
      findings.violations.push({ code: 'not-eligible', reasons: assessment.reasons });
      return;
    }
    // Asking again about the unit one already holds is a repeat, not a conflict.
    if (holdsUnitOf(booking, requirementIndex, candidate.resource.id)) {
      return;
    }
  }
  if (findOpenUnit(booking, requirementIndex) === NO_UNIT) {
    findings.violations.push({ code: 'no-open-unit' });
  }
}

/** Handing an employee's unit back. */
export function analyzeUnassign(
  context: ImpactContext,
  change: Extract<ProposedChange, { kind: 'unassign' }>,
  findings: Findings,
): void {
  if (!requireStatus(findings, change.booking, 'unassign')) {
    return;
  }
  const plan = planRelease({
    booking: change.booking,
    service: context.service,
    resourceId: change.resourceId,
    now: context.now,
  });
  if (plan.kind === 'denied') {
    findings.violations.push({ code: plan.denial });
  }
}
