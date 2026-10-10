import { RESOURCE_TYPES } from '../../application/contracts/booking-constraints';

import { EMPTY_PLAN, planFormOf } from './availability-plan-form';

import type { ResourceDto } from '../dto/setup-dto';
import type { AvailabilityPlanForm } from '../schemas/availability-plan-schema';

/** The value of "available at every location"; a real id is never this word. */
export const ANY_LOCATION = 'any';

/** What the resource form edits, in the shapes its inputs hold (skills as one comma-separated text). */
export interface ResourceDraft {
  readonly name: string;
  readonly type: string;
  readonly locationId: string;
  readonly capacity: number | null;
  readonly skills: string;
  readonly isActive: boolean;
  readonly hasOwnHours: boolean;
  readonly availability: AvailabilityPlanForm;
}

const NEW_RESOURCE: ResourceDraft = {
  name: '',
  type: RESOURCE_TYPES[0],
  locationId: ANY_LOCATION,
  capacity: null,
  skills: '',
  isActive: true,
  hasOwnHours: false,
  availability: EMPTY_PLAN,
};

function savedResourceDraft(resource: ResourceDto): ResourceDraft {
  return {
    name: resource.name,
    type: resource.type,
    locationId: resource.locationId ?? ANY_LOCATION,
    capacity: resource.capacity,
    skills: resource.skills.join(', '),
    isActive: resource.isActive,
    hasOwnHours: resource.availability !== null,
    availability: planFormOf(resource.availability),
  };
}

/** The form's starting values: the saved resource, or a new active one available everywhere. */
export function resourceDraftOf(resource: ResourceDto | undefined): ResourceDraft {
  return resource === undefined ? NEW_RESOURCE : savedResourceDraft(resource);
}

function parseSkills(text: string): string[] {
  return text
    .split(',')
    .map((skill) => skill.trim().toLowerCase())
    .filter((skill) => skill !== '');
}

/** What is sent to the server action; the schema and the server validate it again. */
export function toResourceInput(
  websiteId: string,
  resourceId: string | undefined,
  draft: ResourceDraft,
) {
  return {
    websiteId,
    ...(resourceId === undefined ? {} : { id: resourceId }),
    locationId: draft.locationId === ANY_LOCATION ? null : draft.locationId,
    name: draft.name.trim(),
    type: draft.type,
    skills: parseSkills(draft.skills),
    capacity: draft.capacity,
    availability: draft.hasOwnHours ? draft.availability : null,
    isActive: draft.isActive,
  };
}
