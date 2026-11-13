import { analyzeAssign, analyzeUnassign } from './analyze-assignment-changes';
import { analyzeCancel, analyzeCreate, analyzeReschedule } from './analyze-booking-changes';

import type { Findings } from './impact-findings';
import type { ImpactAnalysis, ImpactContext, ProposedChange } from './impact-types';

/**
 * Examines a proposed change before anything is saved, and reports what stands in its way
 * (violations), what it will cause (warnings) and what could not be examined (unchecked). Pure: it
 * reads only what it is given, sends nothing and changes nothing. It uses the same rules as the
 * operations (the lifecycle table, the change policy, the scheduling engine, the eligibility
 * check), so an analysis that finds no violation matches what the operation will accept.
 */
export function analyzeChange(context: ImpactContext, change: ProposedChange): ImpactAnalysis {
  const findings: Findings = { violations: [], warnings: [], unchecked: [] };
  switch (change.kind) {
    case 'create':
      analyzeCreate(context, change, findings);
      break;
    case 'cancel':
      analyzeCancel(context, change, findings);
      break;
    case 'reschedule':
      analyzeReschedule(context, change, findings);
      break;
    case 'assign':
      analyzeAssign(context, change, findings);
      break;
    case 'unassign':
      analyzeUnassign(context, change, findings);
      break;
  }
  return { isBlocked: findings.violations.length > 0, ...findings };
}
