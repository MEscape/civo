import { SERVICE_SECTIONS } from '../routes';

import { SERVICE_STEPS } from './service-steps';

import type { ServiceSection } from '../routes';
import type { ServiceStepKey } from './service-steps';

type RawParam = string | string[] | undefined;

const firstOf = (raw: RawParam) => (Array.isArray(raw) ? raw[0] : raw);

/** The wizard step the address names; anything else is the first step, never an error page. */
export function parseServiceStep(raw: RawParam): ServiceStepKey {
  return SERVICE_STEPS.find((step) => step === firstOf(raw)) ?? 'general';
}

/** The part of a service the address asks to edit; anything else walks through all of them. */
export function parseServiceSection(raw: RawParam): ServiceSection {
  return SERVICE_SECTIONS.find((section) => section === firstOf(raw)) ?? 'all';
}
