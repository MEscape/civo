import { isPlainObject, isValidUrl } from '@lib/utils';

/** A homogeneous source's evidence, copied onto each snapshot record before mapping. */
export interface DataProvenance {
  readonly kind: 'live' | 'snapshot' | 'synthetic';
  readonly sourceId: string;
  readonly sourceUrl: string | null;
  readonly fetchedAt: string;
  readonly validUntil: string | null;
  readonly license: string | null;
  readonly licenseUrl: string | null;
  readonly attribution: string | null;
}

const MAX_LABEL = 500;
const MAX_URL = 2_048;
const KEYS = [
  'kind',
  'sourceId',
  'sourceUrl',
  'fetchedAt',
  'validUntil',
  'license',
  'licenseUrl',
  'attribution',
];
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    UTC_INSTANT.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function isLabel(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_LABEL)
  );
}

function isSourceUrl(value: unknown): value is string | null {
  if (value === null) {
    return true;
  }
  if (typeof value !== 'string' || value.length > MAX_URL || !isValidUrl(value)) {
    return false;
  }
  const parsed = new URL(value);
  return parsed.username === '' && parsed.password === '';
}

/** Validates persisted evidence independently of the transport and without accepting unknown fields. */
export function isDataProvenance(raw: unknown): raw is DataProvenance {
  if (!isPlainObject(raw) || Object.keys(raw).some((key) => !KEYS.includes(key))) {
    return false;
  }
  return hasIdentity(raw) && hasEvidence(raw) && hasMetadata(raw);
}

function hasIdentity(raw: Record<string, unknown>): boolean {
  const id = raw['sourceId'];
  return typeof id === 'string' && id.length > 0 && id.length <= MAX_LABEL;
}

function hasEvidence(raw: Record<string, unknown>): boolean {
  const kind = raw['kind'];
  if (kind === 'synthetic') {
    return true;
  }
  return (
    (kind === 'live' || kind === 'snapshot') &&
    raw['sourceUrl'] !== null &&
    raw['license'] !== null &&
    raw['attribution'] !== null
  );
}

function hasMetadata(raw: Record<string, unknown>): boolean {
  const hasTime =
    isInstant(raw['fetchedAt']) && (raw['validUntil'] === null || isInstant(raw['validUntil']));
  const hasLabels = isLabel(raw['license']) && isLabel(raw['attribution']);
  const hasUrls = isSourceUrl(raw['sourceUrl']) && isSourceUrl(raw['licenseUrl']);
  return hasTime && hasLabels && hasUrls;
}
