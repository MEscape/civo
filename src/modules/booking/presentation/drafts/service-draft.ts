import { trimToNull } from '@lib/utils';

import {
  CHANGE_ACTORS,
  INFORMATION_FIELDS,
  RESOURCE_TYPES,
} from '../../application/contracts/booking-constraints';

import { EMPTY_PLAN, planFormOf } from './availability-plan-form';

import type { InformationField } from '../../application/contracts/booking-constraints';
import type { LocationDto, ServiceDto } from '../dto/setup-dto';
import type { AvailabilityPlanForm } from '../schemas/availability-plan-schema';

/** What the service form edits, in the shapes its inputs hold (text for lists, flags per field). */
export interface RequirementDraft {
  readonly resourceType: string;
  readonly skills: string;
  readonly count: number;
  readonly resourceIds: readonly string[];
}

export interface PolicyDraft {
  readonly isAllowed: boolean;
  readonly deadlineMinutes: number;
  readonly allowedActors: readonly string[];
}

export type InformationDraft = Readonly<
  Record<InformationField, { enabled: boolean; isRequired: boolean }>
>;

/** The whole form. Numbers are `null` while their input is empty. */
export interface ServiceDraft {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly instructions: string;
  readonly isActive: boolean;
  readonly duration: number | null;
  readonly preparation: number | null;
  readonly cleanup: number | null;
  readonly slotInterval: number | null;
  readonly notice: number | null;
  readonly horizon: number | null;
  readonly perBooking: number | null;
  readonly perSession: number | null;
  readonly locationIds: readonly string[];
  readonly requirements: readonly RequirementDraft[];
  readonly information: InformationDraft;
  readonly documents: string;
  readonly cancellation: PolicyDraft;
  readonly rescheduling: PolicyDraft;
  readonly hasOwnHours: boolean;
  readonly availability: AvailabilityPlanForm;
}

const ONE_DAY_MINUTES = 1_440;
const DEFAULT_DURATION = 30;
const DEFAULT_SLOT_INTERVAL = 15;
const DEFAULT_NOTICE = 60;
const DEFAULT_HORIZON = 60;

const DEFAULT_POLICY: PolicyDraft = {
  isAllowed: true,
  deadlineMinutes: ONE_DAY_MINUTES,
  allowedActors: CHANGE_ACTORS,
};

export const DEFAULT_REQUIREMENT: RequirementDraft = {
  resourceType: RESOURCE_TYPES[0],
  skills: '',
  count: 1,
  resourceIds: [],
};

const DEFAULT_INFORMATION: InformationDraft = {
  firstName: { enabled: true, isRequired: true },
  lastName: { enabled: true, isRequired: true },
  email: { enabled: true, isRequired: true },
  phone: { enabled: false, isRequired: false },
  referenceNumber: { enabled: false, isRequired: false },
  notes: { enabled: false, isRequired: false },
};

/** A service nobody has configured yet: the usual half-hour appointment at the first location. */
function newServiceDraft(locations: readonly LocationDto[]): ServiceDraft {
  return {
    name: '',
    description: '',
    category: '',
    instructions: '',
    isActive: true,
    duration: DEFAULT_DURATION,
    preparation: 0,
    cleanup: 0,
    slotInterval: DEFAULT_SLOT_INTERVAL,
    notice: DEFAULT_NOTICE,
    horizon: DEFAULT_HORIZON,
    perBooking: 1,
    perSession: 1,
    locationIds: locations.slice(0, 1).map((location) => location.id),
    requirements: [DEFAULT_REQUIREMENT],
    information: DEFAULT_INFORMATION,
    documents: '',
    cancellation: DEFAULT_POLICY,
    rescheduling: DEFAULT_POLICY,
    hasOwnHours: false,
    availability: EMPTY_PLAN,
  };
}

function informationOf(service: ServiceDto): InformationDraft {
  const draft = Object.fromEntries(
    INFORMATION_FIELDS.map((field) => [field, { enabled: false, isRequired: false }]),
  ) as Record<InformationField, { enabled: boolean; isRequired: boolean }>;
  for (const { field, isRequired } of service.information) {
    draft[field] = { enabled: true, isRequired };
  }
  return draft;
}

function savedServiceDraft(service: ServiceDto): ServiceDraft {
  return {
    name: service.name,
    description: service.description ?? '',
    category: service.category ?? '',
    instructions: service.instructions ?? '',
    isActive: service.isActive,
    duration: service.durationMinutes,
    preparation: service.preparationMinutes,
    cleanup: service.cleanupMinutes,
    slotInterval: service.slotIntervalMinutes,
    notice: service.noticeMinutes,
    horizon: service.horizonDays,
    perBooking: service.participantsPerBooking,
    perSession: service.participantsPerSession,
    locationIds: service.locationIds,
    requirements: service.requirements.map((requirement) => ({
      resourceType: requirement.resourceType,
      skills: requirement.skills.join(', '),
      count: requirement.count,
      resourceIds: requirement.resourceIds ?? [],
    })),
    information: informationOf(service),
    documents: service.requiredDocuments.join('\n'),
    cancellation: service.cancellation,
    rescheduling: service.rescheduling,
    hasOwnHours: service.availability !== null,
    availability: planFormOf(service.availability),
  };
}

/** The form's starting values: the saved service, or a sensible new one. */
export function draftOf(
  service: ServiceDto | undefined,
  locations: readonly LocationDto[],
): ServiceDraft {
  return service === undefined ? newServiceDraft(locations) : savedServiceDraft(service);
}

/** Splits free text into trimmed, non-empty items. */
function parseList(text: string, separator: RegExp): string[] {
  return text
    .split(separator)
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

/** An empty number input is sent as 0, which the schema then rejects with the field's own message. */
function orZero(value: number | null): number {
  return value ?? 0;
}

/** What is sent to the server action; the schema and the server validate it again. */
export function toServiceInput(
  websiteId: string,
  serviceId: string | undefined,
  draft: ServiceDraft,
) {
  return {
    websiteId,
    ...(serviceId === undefined ? {} : { id: serviceId }),
    name: draft.name.trim(),
    description: trimToNull(draft.description),
    category: trimToNull(draft.category),
    isActive: draft.isActive,
    durationMinutes: orZero(draft.duration),
    preparationMinutes: orZero(draft.preparation),
    cleanupMinutes: orZero(draft.cleanup),
    slotIntervalMinutes: orZero(draft.slotInterval),
    locationIds: draft.locationIds,
    requirements: draft.requirements.map((requirement) => ({
      resourceType: requirement.resourceType,
      skills: parseList(requirement.skills.toLowerCase(), /,/),
      count: requirement.count,
      resourceIds: requirement.resourceIds.length === 0 ? null : requirement.resourceIds,
    })),
    participantsPerBooking: orZero(draft.perBooking),
    participantsPerSession: orZero(draft.perSession),
    noticeMinutes: orZero(draft.notice),
    horizonDays: orZero(draft.horizon),
    availability: draft.hasOwnHours ? draft.availability : null,
    cancellation: draft.cancellation,
    rescheduling: draft.rescheduling,
    information: INFORMATION_FIELDS.flatMap((field) =>
      draft.information[field].enabled
        ? [{ field, isRequired: draft.information[field].isRequired }]
        : [],
    ),
    requiredDocuments: parseList(draft.documents, /\r?\n/),
    instructions: trimToNull(draft.instructions),
  };
}
