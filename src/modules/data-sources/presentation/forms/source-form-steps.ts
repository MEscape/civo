import type { RestSourceForm } from '../schemas/rest-source-form-schema';

export const SOURCE_FORM_STEPS = ['connection', 'records', 'review'] as const;
export type SourceFormStep = (typeof SOURCE_FORM_STEPS)[number];

export const SOURCE_STEP_LABELS = {
  connection: 'sourceForm.steps.connection.title',
  records: 'sourceForm.steps.records.title',
  review: 'sourceForm.steps.review.title',
} as const;

export const SOURCE_STEP_FIELDS = {
  connection: ['name', 'baseUrl', 'authMode'],
  records: [
    'recordsPath',
    'paginationKind',
    'limitParam',
    'offsetParam',
    'pageParam',
    'sizeParam',
    'cursorParam',
    'nextCursorPath',
    'nextUrlPath',
    'pageSize',
    'areaParam',
    'areaTemplate',
  ],
  review: [],
} as const satisfies Record<SourceFormStep, ReadonlyArray<keyof RestSourceForm>>;

export function parseSourceFormStep(raw: unknown): SourceFormStep {
  return SOURCE_FORM_STEPS.find((step) => step === raw) ?? 'connection';
}
