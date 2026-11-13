import type { DatasetForm } from '../schemas/new-dataset-schema';

export const DATASET_FORM_STEPS = ['basics', 'endpoint', 'review'] as const;
export type DatasetFormStep = (typeof DATASET_FORM_STEPS)[number];

export const DATASET_STEP_LABELS = {
  basics: 'datasetForm.steps.basics',
  endpoint: 'datasetForm.steps.endpoint',
  review: 'datasetForm.steps.review',
} as const;

export const DATASET_STEP_FIELDS = {
  basics: ['name', 'canonicalKind'],
  endpoint: ['path'],
  review: [],
} as const satisfies Record<DatasetFormStep, ReadonlyArray<keyof DatasetForm>>;

export function parseDatasetFormStep(raw: unknown): DatasetFormStep {
  return DATASET_FORM_STEPS.find((step) => step === raw) ?? 'basics';
}
