import { LOCATION_SECTIONS } from '../routes';

import { WIZARD_STEPS } from './wizard-steps';

import type { LocationSection } from '../routes';
import type { WizardStepKey } from './wizard-steps';

type RawParam = string | string[] | undefined;

const firstOf = (raw: RawParam) => (Array.isArray(raw) ? raw[0] : raw);

/** The wizard step the address names; anything else is the first step, never an error page. */
export function parseWizardStep(raw: RawParam): WizardStepKey {
  return WIZARD_STEPS.find((step) => step === firstOf(raw)) ?? 'basics';
}

/** The part of a location the address asks to edit; anything else walks through all of them. */
export function parseLocationSection(raw: RawParam): LocationSection {
  return LOCATION_SECTIONS.find((section) => section === firstOf(raw)) ?? 'all';
}

/** The years holidays can be imported for: this one and the next two. */
export function holidayYears(thisYear: number): number[] {
  return [thisYear, thisYear + 1, thisYear + 2];
}
