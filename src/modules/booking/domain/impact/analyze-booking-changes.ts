import { deepEqual } from '@lib/utils';

import { assignmentsForSlot } from '../lifecycle/slot-assignments';
import { evaluateCancellation, evaluateRescheduling } from '../policies/change-policy';
import { evaluateBookable } from '../policies/service-policy';

import { assessStart, employeesOf, requireStatus, warnCustomer } from './impact-findings';

import type { Findings } from './impact-findings';
import type { ImpactContext, ProposedChange } from './impact-types';

/** A booking that does not exist yet: is the service bookable here, and is the start free? */
export function analyzeCreate(
  context: ImpactContext,
  change: Extract<ProposedChange, { kind: 'create' }>,
  findings: Findings,
): void {
  const denial = evaluateBookable(context.service, change.locationId, change.channel);
  if (denial !== null) {
    findings.violations.push({ code: denial });
  }
  if (change.scheduling === null) {
    findings.unchecked.push('slot');
    return;
  }
  assessStart(findings, context.service, { scheduling: change.scheduling, start: change.start });
}

export function analyzeCancel(
  context: ImpactContext,
  change: Extract<ProposedChange, { kind: 'cancel' }>,
  findings: Findings,
): void {
  const { booking, actor } = change;
  if (!requireStatus(findings, booking, 'cancel')) {
    return;
  }
  const denial = evaluateCancellation(context.service, booking, { actor, now: context.now });
  if (denial !== null) {
    findings.violations.push({ code: 'change-refused', change: 'cancellation', denial });
    return;
  }
  warnCustomer(findings, booking, actor);
  const employees = employeesOf(booking.assignments);
  if (employees.length > 0) {
    findings.warnings.push({ code: 'employees-released', resourceIds: employees });
  }
}

export function analyzeReschedule(
  context: ImpactContext,
  change: Extract<ProposedChange, { kind: 'reschedule' }>,
  findings: Findings,
): void {
  const { booking, actor } = change;
  if (!requireStatus(findings, booking, 'reschedule')) {
    return;
  }
  const denial = evaluateRescheduling(context.service, booking, { actor, now: context.now });
  if (denial !== null) {
    findings.violations.push({ code: 'change-refused', change: 'rescheduling', denial });
  }
  if (change.scheduling === null) {
    findings.unchecked.push('slot');
    return;
  }
  const slot = assessStart(findings, context.service, {
    scheduling: change.scheduling,
    start: change.start,
  });
  if (slot === null || denial !== null) {
    return;
  }
  warnCustomer(findings, booking, actor);
  const before = employeesOf(booking.assignments);
  const after = employeesOf(assignmentsForSlot(context.service, slot));
  if (!deepEqual(before, after)) {
    findings.warnings.push({ code: 'employees-change', before, after });
  }
}
