import { RESOURCE_SECTIONS } from '../routes';

import type { ResourceSection } from '../routes';

/** The steps of the resource wizard, in order; the last one reviews and saves. */
export const RESOURCE_STEPS = ['basics', 'availability', 'review'] as const;
export type ResourceStepKey = (typeof RESOURCE_STEPS)[number];
export type ResourcePartKey = Exclude<ResourceStepKey, 'review'>;

/** The fields a step shows, which are checked before the wizard moves on. */
export const FIELDS_OF_RESOURCE_STEP: Readonly<Record<ResourcePartKey, readonly string[]>> = {
  basics: ['name', 'type', 'capacity', 'setupMinutes', 'teardownMinutes', 'internalNote'],
  availability: ['followsLocation', 'openingHours'],
};

/** The part a field path belongs to, by the first name of its path. */
export function resourcePartOfPath(path: string): ResourcePartKey {
  const [field = ''] = path.split('.');
  return field === 'followsLocation' || field === 'openingHours' ? 'availability' : 'basics';
}

/** The first step, in order, that holds a field of one of these paths. */
export function firstResourceStepWith(paths: Iterable<string>): ResourcePartKey | undefined {
  const parts = new Set(Array.from(paths, resourcePartOfPath));
  return RESOURCE_STEPS.find((key): key is ResourcePartKey => key !== 'review' && parts.has(key));
}

type RawParam = string | string[] | undefined;

const firstOf = (raw: RawParam) => (Array.isArray(raw) ? raw[0] : raw);

/** The wizard step the address names; anything else is the first step, never an error page. */
export function parseResourceStep(raw: RawParam): ResourceStepKey {
  return RESOURCE_STEPS.find((key) => key === firstOf(raw)) ?? 'basics';
}

/** The part of a resource the address asks to edit; anything else walks through all of them. */
export function parseResourceSection(raw: RawParam): ResourceSection {
  return RESOURCE_SECTIONS.find((section) => section === firstOf(raw)) ?? 'all';
}
