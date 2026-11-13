/** The steps of the service wizard, in order; the last one reviews and saves. */
export const SERVICE_STEPS = ['general', 'timing', 'resources', 'rules', 'review'] as const;
export type ServiceStepKey = (typeof SERVICE_STEPS)[number];

/** The parts a service can be edited in, each a step of the wizard but the review. */
export type ServicePartKey = Exclude<ServiceStepKey, 'review'>;

/**
 * The steps a new service walks through. Resources are a step only where the location has any: a
 * resource cannot be made from inside the wizard without losing what was typed, so there is nothing
 * to choose in it, and no step to explain that.
 */
export function serviceStepsFor(hasResources: boolean): readonly ServiceStepKey[] {
  return hasResources ? SERVICE_STEPS : SERVICE_STEPS.filter((step) => step !== 'resources');
}

/** The parts in order. */
export const SERVICE_PARTS = SERVICE_STEPS.filter(
  (step): step is ServicePartKey => step !== 'review',
);

/** The part of the form a field belongs to, by the first name of its path. */
const PART_BY_FIELD: Readonly<Record<string, ServicePartKey>> = {
  name: 'general',
  description: 'general',
  category: 'general',
  documents: 'general',
  instructions: 'general',
  internalNote: 'general',
  isOnlineBookable: 'general',
  isActive: 'general',
  durationMinutes: 'timing',
  preparationMinutes: 'timing',
  cleanupMinutes: 'timing',
  resources: 'resources',
  noticeMinutes: 'rules',
  horizonDays: 'rules',
  cancelUntilMinutes: 'rules',
  changeUntilMinutes: 'rules',
  actors: 'rules',
  employee: 'rules',
  qualification: 'rules',
};

/** The fields a step shows, which are checked before the wizard moves on. */
export const FIELDS_OF_STEP: Readonly<Record<ServicePartKey, readonly string[]>> = {
  general: [
    'name',
    'description',
    'category',
    'documents',
    'instructions',
    'internalNote',
    'isOnlineBookable',
    'isActive',
  ],
  timing: ['durationMinutes', 'preparationMinutes', 'cleanupMinutes'],
  resources: ['resources'],
  rules: [
    'noticeMinutes',
    'horizonDays',
    'cancelUntilMinutes',
    'changeUntilMinutes',
    'actors',
    'employee',
    'qualification',
  ],
};

/** The part a field path belongs to: where a failed save has to take a wizard. */
export function partOfPath(path: string): ServicePartKey {
  const [field = ''] = path.split('.');
  return PART_BY_FIELD[field] ?? 'general';
}

/** The parts that hold any of these field paths. */
export function partsOfPaths(paths: Iterable<string>): ReadonlySet<ServicePartKey> {
  return new Set(Array.from(paths, partOfPath));
}

/** The first of `steps`, in order, that holds one of `parts`; the review has no fields of its own. */
export function firstStepWith(
  parts: ReadonlySet<string>,
  steps: readonly ServiceStepKey[] = SERVICE_STEPS,
): ServicePartKey | undefined {
  return steps.find((key): key is ServicePartKey => key !== 'review' && parts.has(key));
}
