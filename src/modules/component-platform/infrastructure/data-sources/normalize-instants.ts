/** A date or date-time written the ISO way. Anything else (a bare "5") is left for the contract to reject. */
const ISO_LIKE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T.+)?$/;

function toCanonicalInstant(value: unknown): unknown {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? value : value.toISOString();
  }
  if (typeof value === 'string' && ISO_LIKE_PATTERN.test(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return value;
}

/**
 * The mapping engine's date transforms yield `Date` objects, and source
 * strings may carry any offset. The contracts accept one exact form (UTC,
 * millisecond precision), so the fields the contract names as instants are
 * converted here, at the boundary, and the domain never does date
 * arithmetic. A date-only value means midnight UTC.
 *
 * Why this is still needed with one shared `Clock`: that clock fixes how
 * THIS system reads "now". This function deals with EXTERNAL data, whose
 * offsets and shapes the system does not control, and with the engine's
 * live (unpersisted) `Date` values. The contract owner (this module, via
 * `instantFields`) is the one that knows which fields are instants, so the
 * conversion belongs here and not in the mapping engine, which only knows
 * target paths.
 */
export function normalizeInstants(
  values: Readonly<Record<string, unknown>>,
  instantFields: readonly string[],
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...values };
  for (const field of instantFields) {
    if (field in normalized) {
      normalized[field] = toCanonicalInstant(normalized[field]);
    }
  }
  return normalized;
}
