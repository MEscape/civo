import type { NewPage } from '../schemas/new-page-schema';

export const NEW_PAGE_STEPS = ['page', 'review'] as const;
export type NewPageStep = (typeof NEW_PAGE_STEPS)[number];

export const NEW_PAGE_STEP_LABELS = {
  page: 'pages.createForm.steps.page',
  review: 'pages.createForm.steps.review',
} as const satisfies Record<NewPageStep, string>;

export const NEW_PAGE_STEP_FIELDS = {
  page: ['title', 'path'],
  review: [],
} as const satisfies Record<NewPageStep, ReadonlyArray<keyof NewPage>>;

/** The step the address asks for; anything else starts at the beginning. */
export function parseNewPageStep(raw: unknown): NewPageStep {
  return NEW_PAGE_STEPS.find((step) => step === raw) ?? 'page';
}
