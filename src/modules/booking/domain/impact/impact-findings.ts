import { isActionAllowed } from '../lifecycle/booking-actions';
import { slotMatchesService } from '../lifecycle/slot-assignments';
import { assessSlot } from '../scheduling/slot-engine';

import type { UncheckedAspect, Violation, Warning } from './impact-types';
import type { BookingAction } from '../lifecycle/booking-actions';
import type { BookableService, ChangeActor } from '../models/bookable-service';
import type { Assignment, Booking } from '../models/booking';
import type { BookableResourceId } from '../models/ids';
import type { PlannedSlot, Scheduling } from '../scheduling/scheduling-types';
import type { Instant } from '../time/instant';

/** The findings of one analysis, collected as the checks run. */
export interface Findings {
  readonly violations: Violation[];
  readonly warnings: Warning[];
  readonly unchecked: UncheckedAspect[];
}

/** Records a violation and answers `false` when the booking's status does not allow `action`. */
export function requireStatus(
  findings: Findings,
  booking: Booking,
  action: BookingAction,
): boolean {
  if (isActionAllowed(booking.status, action)) {
    return true;
  }
  findings.violations.push({ code: 'status-not-allowed', status: booking.status, action });
  return false;
}

/** Somebody else changing a visitor's booking is a thing the visitor is told about. */
export function warnCustomer(findings: Findings, booking: Booking, actor: ChangeActor): void {
  if (actor !== 'customer' && booking.customer !== null) {
    findings.warnings.push({ code: 'customer-notified' });
  }
}

/** The employees on a list of assignments, sorted. */
export function employeesOf(assignments: readonly Assignment[]): BookableResourceId[] {
  return assignments
    .flatMap((unit) =>
      unit.resourceType === 'employee' && unit.resourceId !== null ? [unit.resourceId] : [],
    )
    .sort();
}

/**
 * Asks the engine about a start and records what is wrong with it. Answers the slot when it can be
 * booked. A slot the service could not have produced (the schedule was built for another service)
 * is a violation too, because the operations would refuse it: the analysis must not be more
 * generous than what it analyses.
 */
export function assessStart(
  findings: Findings,
  service: BookableService,
  question: { readonly scheduling: Scheduling; readonly start: Instant },
): PlannedSlot | null {
  const assessment = assessSlot(question.scheduling, question.start);
  if (assessment.kind === 'rejected') {
    findings.violations.push({ code: 'slot-rejected', reason: assessment.reason });
    return null;
  }
  if (!slotMatchesService(service, assessment.slot)) {
    findings.violations.push({ code: 'slot-does-not-fit-service' });
    return null;
  }
  return assessment.slot;
}
