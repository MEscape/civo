import type { DayDto } from '../dto/location-dto';
import type { ResourceDto } from '../dto/resource-dto';
import type { ResourceFormValues } from '../schemas/resource-schema';

/** The kind a new resource starts with: the mockups' most common one. */
export const DEFAULT_RESOURCE_KIND = 'room';

const copyOf = ({ intervals, breaks }: DayDto) => ({
  intervals: intervals.map((range) => ({ ...range })),
  breaks: breaks.map((range) => ({ ...range })),
});

const closures = (blocks: ResourceDto['blocks']) =>
  blocks.map(({ from, to }) => ({ kind: 'closed' as const, from, to }));

/**
 * What the create form starts with: one place, no buffers, usable whenever the location is open.
 * The week shown under "own times" starts as the location's, so choosing it narrows what is there.
 */
export function newResourceValues(locationWeekly: readonly DayDto[]): ResourceFormValues {
  return {
    name: '',
    type: DEFAULT_RESOURCE_KIND,
    capacity: 1,
    setupMinutes: 0,
    teardownMinutes: 0,
    internalNote: '',
    followsLocation: true,
    openingHours: { weekly: locationWeekly.map(copyOf), exceptions: [] },
  };
}

/** A resource as the form edits it. */
export function toResourceFormValues(resource: ResourceDto): ResourceFormValues {
  return {
    name: resource.name,
    type: resource.type,
    capacity: resource.places,
    setupMinutes: resource.setupMinutes,
    teardownMinutes: resource.teardownMinutes,
    internalNote: resource.internalNote,
    followsLocation: resource.followsLocation,
    openingHours: { weekly: resource.weekly.map(copyOf), exceptions: closures(resource.blocks) },
  };
}

/** What a change sends, from the form's values: the kind is not part of a change. */
export function toResourceInput({ type: _type, ...rest }: ResourceFormValues) {
  return rest;
}
