import type { MapEditorValues } from '../schemas/saved-map-schema';
import type { FieldPath } from 'react-hook-form';

export const MAP_EDITOR_STEPS = ['basics', 'content', 'design', 'review'] as const;
export type MapEditorStep = (typeof MAP_EDITOR_STEPS)[number];

export const MAP_STEP_LABELS = {
  basics: 'management.basics',
  content: 'management.content',
  design: 'management.appearance',
  review: 'management.review',
} as const;

export const MAP_STEP_FIELDS = {
  basics: ['name', 'description'],
  content: ['settings.layers', 'settings.locations'],
  design: [
    'settings.initialBounds',
    'settings.featureLimit',
    'settings.pointStyle',
    'settings.interaction',
    'settings.height',
    'settings.colorBy',
    'settings.sizeBy',
  ],
  review: ['settings.isPublic'],
} as const satisfies Record<MapEditorStep, ReadonlyArray<FieldPath<MapEditorValues>>>;

export function parseMapEditorStep(raw: unknown): MapEditorStep {
  return MAP_EDITOR_STEPS.find((step) => step === raw) ?? 'basics';
}

/** Opening a map just created: its page says it was saved, once. */
export const CREATED_PARAM = 'created';
