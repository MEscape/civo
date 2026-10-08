/**
 * Numeric helpers and locale-aware number formatting. Zero dependencies.
 * Display formatting takes an explicit locale and uses `Intl`, never
 * hand-built strings (i18n.md).
 */

/** Clamps `value` into `[min, max]`, inclusive. Throws when `min > max`. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError('clamp: min must not be greater than max');
  }
  return Math.min(Math.max(value, min), max);
}

/** Formats a number for a locale, e.g. `1.234,5` for `de-DE`. */
export function formatNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/** Formats a ratio as a percentage, e.g. `0.256` becomes `26 %` in `de-DE`. */
export function formatPercent(ratio: number, locale: string, fractionDigits = 0): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(ratio);
}

/**
 * Formats an amount held in integer minor units (cents) as currency.
 * Money is never handled as floating point (persistence.md), so the
 * conversion happens only here at the presentation edge.
 */
export function formatMoney(minorUnits: number, currency: string, locale: string): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(minorUnits / 10 ** fractionDigits);
}

/** Formats a byte count using `Intl` units, e.g. `1,5 MB`. Uses binary (1024) steps. */
export function formatBytes(bytes: number, locale: string, fractionDigits = 1): string {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;
  const sign = bytes < 0 ? -1 : 1;
  const absolute = Math.abs(bytes);

  const exponent =
    absolute === 0
      ? 0
      : Math.min(Math.floor(Math.log(absolute) / Math.log(1024)), units.length - 1);

  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: units[exponent],
    unitDisplay: 'short',
    maximumFractionDigits: exponent === 0 ? 0 : fractionDigits,
  }).format((sign * absolute) / 1024 ** exponent);
}
