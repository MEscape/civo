'use client';

import { useMemo } from 'react';

import { FieldMessage } from '@components/shared/field-message';
import { Label } from '@components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

export interface TimeZoneFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly value: string;
  readonly onValueChange: (zone: string) => void;
}

const FALLBACK_ZONES = ['Europe/Berlin'] as const;
/** Shown first: the zones a municipal website is most likely in. */
const FIRST_REGION = 'Europe';

function knownZones(): readonly string[] {
  return typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : FALLBACK_ZONES;
}

function regionOf(zone: string): string {
  return zone.includes('/') ? (zone.split('/')[0] ?? zone) : 'Other';
}

/** The zones grouped by region, Europe first, the saved zone included even if the browser does not list it. */
function groupedZones(current: string): ReadonlyArray<readonly [string, readonly string[]]> {
  const zones = new Set(knownZones());
  if (current !== '') {
    zones.add(current);
  }
  const groups = new Map<string, string[]>();
  for (const zone of [...zones].sort()) {
    const region = regionOf(zone);
    groups.set(region, [...(groups.get(region) ?? []), zone]);
  }
  const rank = (region: string) => (region === FIRST_REGION ? 0 : 1);
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

/** A time zone chosen from the zones the browser knows, grouped by region, with the offset in effect. */
export function TimeZoneField({
  id,
  label,
  hint,
  error,
  value,
  onValueChange,
}: TimeZoneFieldProps) {
  const groups = useMemo(() => groupedZones(value), [value]);
  const describedBy = [
    hint === undefined ? null : `${id}-hint`,
    error === undefined ? null : `${id}-error`,
  ]
    .filter((part) => part !== null)
    .join(' ');

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={describedBy === '' ? undefined : describedBy}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {groups.map(([region, zones]) => (
            <SelectGroup key={region}>
              <SelectLabel>{region}</SelectLabel>
              {zones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {hint !== undefined && (
        <p id={`${id}-hint`} className="text-xs text-copy-muted">
          {hint}
        </p>
      )}
      <FieldMessage id={`${id}-error`} message={error} />
    </div>
  );
}
