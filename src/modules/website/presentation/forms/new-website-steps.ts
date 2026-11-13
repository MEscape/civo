import type { NewWebsite } from '../schemas/new-website-schema';

export const NEW_WEBSITE_STEPS = ['basics', 'template', 'review'] as const;
export type NewWebsiteStep = (typeof NEW_WEBSITE_STEPS)[number];

export const NEW_WEBSITE_STEP_LABELS = {
  basics: 'createForm.steps.basics',
  template: 'createForm.steps.template',
  review: 'createForm.steps.review',
} as const satisfies Record<NewWebsiteStep, string>;

export const NEW_WEBSITE_STEP_FIELDS = {
  basics: ['name', 'slug'],
  template: ['templateKey'],
  review: [],
} as const satisfies Record<NewWebsiteStep, ReadonlyArray<keyof NewWebsite>>;

/** The step the address asks for; anything else starts at the beginning. */
export function parseNewWebsiteStep(raw: unknown): NewWebsiteStep {
  return NEW_WEBSITE_STEPS.find((step) => step === raw) ?? 'basics';
}
