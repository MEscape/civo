import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { unique } from '@lib/utils';

import { BOOKING_VALIDATION_CODES as CODES, createBookingErrorBag } from '../errors/booking-errors';
import { compareIds } from '../models/ids';
import { daysBetween } from '../time/local-date';
import { mergeIntervals } from '../time/time-interval';

import type {
  Scheduling,
  SchedulingInput,
  ResourcePool,
  ResourceRequirement,
} from './scheduling-types';

/** Bounds on one scheduling question (performance.md: every input is bounded). */
export const SCHEDULING_LIMITS = {
  maxRangeDays: 62,
  maxRequirements: 6,
  maxCountPerRequirement: 20,
  maxResourcesPerRequirement: 500,
} as const;

/**
 * The candidates of a requirement, each id once (the first listing wins), with normalized lists, in
 * code-unit order of the id, not locale order: the same ids sort the same way on every machine.
 */
function preparePool(requirement: ResourceRequirement): ResourcePool {
  const resources = unique(requirement.resources, (resource) => resource.id)
    .map((resource) => ({
      id: resource.id,
      availability: mergeIntervals(resource.availability),
      busy: mergeIntervals(resource.busy),
      ...(resource.margins === undefined ? {} : { margins: resource.margins }),
    }))
    .sort((a, b) => compareIds(a.id, b.id));
  return { count: requirement.count, resources };
}

function validate(input: SchedulingInput): ValidationAppError | null {
  const limits = SCHEDULING_LIMITS;
  const bag = createBookingErrorBag();
  bag.expect(
    daysBetween(input.range.from, input.range.to) + 1 <= limits.maxRangeDays,
    'range',
    CODES.dateRangeTooLong,
  );
  bag.expect(input.requirements.length <= limits.maxRequirements, 'requirements', CODES.tooMany);
  input.requirements.forEach((requirement, position) => {
    bag.expect(
      Number.isInteger(requirement.count) &&
        requirement.count >= 1 &&
        requirement.count <= limits.maxCountPerRequirement,
      `requirements.${position}.count`,
      CODES.requirementCountInvalid,
    );
    bag.expect(
      requirement.resources.length <= limits.maxResourcesPerRequirement,
      `requirements.${position}.resources`,
      CODES.tooMany,
    );
  });
  return bag.hasErrors ? bag.toError() : null;
}

/** Checks the bounds and normalizes every list. Fails with the field that is out of bounds. */
export function prepareScheduling(
  input: SchedulingInput,
): AppResult<Scheduling, ValidationAppError> {
  const problem = validate(input);
  if (problem !== null) {
    return err(problem);
  }
  return ok({
    zone: input.zone,
    range: input.range,
    rules: input.rules,
    startWindow: input.startWindow,
    openWindows: mergeIntervals(input.openWindows),
    pools: input.requirements.map(preparePool),
    openDemands: input.openDemands ?? [],
  });
}
