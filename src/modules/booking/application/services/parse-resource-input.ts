import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { literalGuard } from '@lib/utils';

import {
  BOOKING_VALIDATION_CODES as CODES,
  createBookingErrorBag,
} from '../../domain/errors/booking-errors';
import { RESOURCE_TYPES } from '../../domain/models/bookable-resource';
import { resourcePlan } from '../../domain/models/resource-availability';
import { SLOT_RULE_LIMITS } from '../../domain/scheduling/slot-rules';
import { parseMinutes } from '../../domain/time/minutes';
import { RESOURCE_LIMITS as LIMITS } from '../contracts/booking-constraints';

import { parseExceptions } from './parse-exceptions';
import { parseWeek } from './parse-hours';

import type { ResourceBlock } from '../../domain/models/resource-availability';
import type { PhysicalResourceKind } from '../../domain/ports/resource-admin.repository';
import type { AvailabilityPlan } from '../../domain/scheduling/availability-plan';
import type { Minutes } from '../../domain/time/minutes';
import type { ResourceInput } from '../contracts/resource-inputs';

/** A resource as the rules hold it, read from what a form sent: everything a change may set. */
export interface ParsedResource {
  readonly name: string;
  readonly capacity: number;
  readonly setupMinutes: Minutes;
  readonly teardownMinutes: Minutes;
  readonly internalNote: string | null;
  readonly availability: AvailabilityPlan | null;
}

const isResourceKind = literalGuard(RESOURCE_TYPES);

/** A kind the administration of resources may create; never `employee`, whose calendar is the team's. */
export function parsePhysicalKind(text: string): PhysicalResourceKind | null {
  return isResourceKind(text) && text !== 'employee' ? text : null;
}

function parseBuffer(value: number): Minutes | null {
  const minutes = parseMinutes(value);
  return minutes !== null && minutes <= SLOT_RULE_LIMITS.bufferMax ? minutes : null;
}

/**
 * Reads what a form sent into what the rules hold, or says which field is wrong, all at once, by
 * the path the form uses. Its hours are read by the same parsers as a location's; a resource's
 * exceptions are blocks only (closed days). "Like the location" with no blocks is stored as no plan
 * at all, so it reads exactly like a resource that was never given one.
 */
export function parseResourceInput(
  input: ResourceInput,
): AppResult<ParsedResource, ValidationAppError> {
  const bag = createBookingErrorBag();
  const name = input.name.trim();
  const note = input.internalNote.trim();
  const setupMinutes = parseBuffer(input.setupMinutes);
  const teardownMinutes = parseBuffer(input.teardownMinutes);
  const { capacityMin, capacityMax } = LIMITS;

  bag.expect(name.length >= 1 && name.length <= LIMITS.nameMax, 'name', CODES.nameInvalid);
  bag.expect(note.length <= LIMITS.noteMax, 'internalNote', CODES.noteInvalid);
  bag.expect(
    Number.isInteger(input.capacity) &&
      input.capacity >= capacityMin &&
      input.capacity <= capacityMax,
    'capacity',
    CODES.capacityInvalid,
  );
  bag.expect(setupMinutes !== null, 'setupMinutes', CODES.bufferInvalid);
  bag.expect(teardownMinutes !== null, 'teardownMinutes', CODES.bufferInvalid);
  const weekly = input.followsLocation ? null : parseWeek(input.openingHours.weekly, bag);
  const exceptions = parseExceptions(input.openingHours.exceptions, bag);
  const blocks = exceptions.filter((exception): exception is ResourceBlock => {
    const isBlock = exception.kind === 'closed';
    bag.expect(isBlock, 'openingHours.exceptions', CODES.exceptionInvalid);
    return isBlock;
  });

  if (
    bag.hasErrors ||
    setupMinutes === null ||
    teardownMinutes === null ||
    (!input.followsLocation && weekly === null)
  ) {
    return err(bag.toError());
  }
  return ok({
    name,
    capacity: input.capacity,
    setupMinutes,
    teardownMinutes,
    internalNote: note === '' ? null : note,
    availability: resourcePlan(weekly, blocks),
  });
}
