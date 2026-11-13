import type { ParsedLocation } from './parse-location-input';
import type { StoredLocation } from '../../domain/ports/location-admin.repository';

export type ChangedSection = 'details' | 'hours' | 'status';

/**
 * Which parts of a location a change touches, for the audit trail: its details (name, address, time
 * zone), its hours (week and exceptions), whether it is switched on. `isHoursChanged` is passed in
 * because the caller has already compared the plans to decide what to ask about.
 */
export function changedSections(
  current: StoredLocation,
  next: ParsedLocation,
  isHoursChanged: boolean,
): ChangedSection[] {
  const isDetailsChanged =
    next.name !== current.name || next.address !== current.address || next.zone !== current.zone;
  return [
    ...(isDetailsChanged ? (['details'] as const) : []),
    ...(isHoursChanged ? (['hours'] as const) : []),
    ...(next.isActive === current.isActive ? [] : (['status'] as const)),
  ];
}
