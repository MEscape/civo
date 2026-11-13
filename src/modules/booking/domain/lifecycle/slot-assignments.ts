import { toBookableResourceId } from '../models/ids';
import { mayLeaveEmployeesUnassigned } from '../policies/service-policy';
import { occupiedSpanOf, appointmentAt } from '../scheduling/slot-rules';

import type { BookableService } from '../models/bookable-service';
import type { Assignment } from '../models/booking';
import type { PlannedSlot } from '../scheduling/scheduling-types';

/**
 * Whether a slot of the scheduling engine is one this service could have produced: the appointment
 * is the one its rules give, every requirement got as many resources as it asks for, and an employee
 * is held for exactly the preparation, appointment and clean-up of the service. What a room or a
 * desk is held for is that resource's own setup and teardown, which the service cannot know. A
 * booking is never built from a slot that fails this.
 */
export function slotMatchesService(service: BookableService, slot: PlannedSlot): boolean {
  const appointment = appointmentAt(slot.start, service.rules);
  const employeeSpan = occupiedSpanOf(appointment, service.rules);
  const isShapedLikeService =
    slot.end === appointment.end &&
    slot.requirementResourceIds.length === service.requirements.length &&
    service.requirements.every(
      (requirement, index) => slot.requirementResourceIds[index]?.length === requirement.count,
    );
  return (
    isShapedLikeService &&
    service.requirements.every((requirement, index) =>
      (slot.requirementResourceIds[index] ?? []).every((id) => {
        const span = slot.resourceSpans[id];
        return (
          span !== undefined &&
          (requirement.resourceType !== 'employee' ||
            (span.start === employeeSpan.start && span.end === employeeSpan.end))
        );
      }),
    )
  );
}

/**
 * The assignments a booking of this service gets on this slot. Rooms and desks are always held. An
 * employee is assigned when the service is `automatic`; for a service that is assigned later (BD-07)
 * the unit stays open: the slot proved that a qualified employee is free, and the booking does not
 * pin one down. Every unit keeps the span its resource is held for, open or not. Needs a slot that
 * `slotMatchesService`.
 */
export function assignmentsForSlot(service: BookableService, slot: PlannedSlot): Assignment[] {
  return service.requirements.flatMap((requirement, requirementIndex) =>
    (slot.requirementResourceIds[requirementIndex] ?? []).flatMap((id) => {
      const occupied = slot.resourceSpans[id];
      return occupied === undefined
        ? []
        : [
            {
              requirementIndex,
              resourceType: requirement.resourceType,
              resourceId:
                requirement.resourceType === 'employee' && mayLeaveEmployeesUnassigned(service)
                  ? null
                  : toBookableResourceId(id),
              occupied,
            },
          ];
    }),
  );
}
