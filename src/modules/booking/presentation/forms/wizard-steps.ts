/** The steps of the location wizard, in order; the last one reviews and saves. */
export const WIZARD_STEPS = ['basics', 'hours', 'exceptions', 'services', 'review'] as const;
export type WizardStepKey = (typeof WIZARD_STEPS)[number];

/**
 * The steps a location walks through. Services are a step only for a new location and only where
 * some other location already has services to start from: there is nothing to choose otherwise.
 */
export function wizardStepsFor(hasServicesToOffer: boolean): readonly WizardStepKey[] {
  return hasServicesToOffer ? WIZARD_STEPS : WIZARD_STEPS.filter((step) => step !== 'services');
}

/** The first step, in order, that holds one of `sections`; the review has no fields of its own. */
export function firstStepWith(sections: ReadonlySet<string>): WizardStepKey | undefined {
  return WIZARD_STEPS.find((key) => key !== 'review' && sections.has(key));
}
