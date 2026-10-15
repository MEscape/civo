import { SERVICE_PRESETS, RESOURCE_PRESETS } from '../presets/booking-presets';

import type { ResourceDraft } from './resource-draft';
import type { ServiceDraft } from './service-draft';

export interface ServicePresetRequest {
  readonly presetKey: string | undefined;
  /** The translated name the preset gives the service. */
  readonly name: string;
  /** The kinds of resource that exist at the place: a preset asks for one of them, not for one that is not there. */
  readonly availableTypes: readonly string[];
}

/**
 * The type of resource a template should ask for: its own when the place has
 * one (or it is a person), else the first thing the place does have, so the
 * service starts out able to work instead of waiting for a kind of room nobody made.
 */
function requiredTypeOf(preferred: string, availableTypes: readonly string[]): string {
  if (preferred === 'employee' || availableTypes.includes(preferred)) {
    return preferred;
  }
  return availableTypes.find((type) => type !== 'employee') ?? preferred;
}

/** The service form's starting values with a preset applied; an unknown key changes nothing. */
export function withServicePreset(
  draft: ServiceDraft,
  request: ServicePresetRequest,
): ServiceDraft {
  const { presetKey, name, availableTypes } = request;
  const preset = SERVICE_PRESETS.find((candidate) => candidate.key === presetKey);
  if (preset === undefined) {
    return draft;
  }
  return {
    ...draft,
    name,
    duration: preset.durationMinutes,
    slotInterval: preset.slotIntervalMinutes,
    preparation: preset.preparationMinutes,
    cleanup: preset.cleanupMinutes,
    notice: preset.noticeMinutes,
    horizon: preset.horizonDays,
    requirements: [
      {
        resourceType: requiredTypeOf(preset.requires, availableTypes),
        skills: [],
        count: 1,
        resourceIds: [],
      },
    ],
  };
}

/** The resource form's starting values with a preset applied; an unknown key changes nothing. */
export function withResourcePreset(
  draft: ResourceDraft,
  presetKey: string | undefined,
  name: string,
): ResourceDraft {
  const preset = RESOURCE_PRESETS.find((candidate) => candidate.key === presetKey);
  return preset === undefined
    ? draft
    : { ...draft, name, type: preset.type, capacity: preset.capacity };
}
