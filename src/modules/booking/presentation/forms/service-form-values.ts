import type { ServiceDto } from '../dto/service-dto';
import type { ServiceFormValues } from '../schemas/service-schema';

/**
 * What the create form starts with: an ordinary appointment a manager changes to what the service
 * is. Nothing here is a rule: the notice, the horizon and the deadlines are starting points in
 * selects, and the employee is "anyone" until a qualification is chosen.
 */
export function newServiceValues(): ServiceFormValues {
  return {
    name: '',
    description: '',
    category: '',
    documents: [],
    instructions: '',
    internalNote: '',
    isOnlineBookable: true,
    isActive: true,
    durationMinutes: 30,
    preparationMinutes: 0,
    cleanupMinutes: 0,
    resources: [],
    noticeMinutes: 1440,
    horizonDays: 90,
    cancelUntilMinutes: 1440,
    changeUntilMinutes: 720,
    actors: ['customer', 'employee', 'manager'],
    employee: 'any',
    qualification: '',
  };
}

/** A service as the form edits it. */
export function toServiceFormValues(service: ServiceDto): ServiceFormValues {
  return {
    name: service.name,
    description: service.description,
    category: service.category,
    documents: [...service.documents],
    instructions: service.instructions,
    internalNote: service.internalNote,
    isOnlineBookable: service.isOnlineBookable,
    isActive: service.isActive,
    durationMinutes: service.durationMinutes,
    preparationMinutes: service.preparationMinutes,
    cleanupMinutes: service.cleanupMinutes,
    resources: service.resources.map(({ id, isRequired }) => ({ resourceId: id, isRequired })),
    noticeMinutes: service.noticeMinutes,
    horizonDays: service.horizonDays,
    cancelUntilMinutes: service.cancelUntilMinutes,
    changeUntilMinutes: service.changeUntilMinutes,
    actors: [...service.actors],
    employee: service.employee,
    qualification: service.qualification,
  };
}

/**
 * The fields every location that has the service shares: a change to one of them reaches all of
 * them. The rest (whether it runs here, takes online bookings, and which resources) is this
 * location's own. It names fields for the words around a change; which part a change touches is
 * decided again by the server, which is what refuses an unacknowledged one.
 */
export const SHARED_FIELDS = [
  'name',
  'description',
  'category',
  'documents',
  'instructions',
  'internalNote',
  'durationMinutes',
  'preparationMinutes',
  'cleanupMinutes',
  'noticeMinutes',
  'horizonDays',
  'cancelUntilMinutes',
  'changeUntilMinutes',
  'actors',
  'employee',
  'qualification',
] as const satisfies ReadonlyArray<keyof ServiceFormValues>;

export type SharedField = (typeof SHARED_FIELDS)[number];

/** The shared fields that differ between what the form started from and what it holds now. */
export function changedSharedFields(
  before: ServiceFormValues,
  after: ServiceFormValues,
): SharedField[] {
  return SHARED_FIELDS.filter(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
  );
}
