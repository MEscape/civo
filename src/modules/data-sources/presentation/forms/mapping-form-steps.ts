export const MAPPING_FORM_STEPS = ['fields', 'review'] as const;
export type MappingFormStep = (typeof MAPPING_FORM_STEPS)[number];

export const MAPPING_STEP_LABELS = {
  fields: 'mapping.steps.fields',
  review: 'mapping.steps.review',
} as const;

export function parseMappingFormStep(raw: unknown): MappingFormStep {
  return MAPPING_FORM_STEPS.find((step) => step === raw) ?? 'fields';
}
