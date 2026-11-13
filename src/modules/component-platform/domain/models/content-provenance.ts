/** Display-safe evidence supplied by an adapter; transport and persistence stay outside this module. */
export interface ContentProvenance {
  readonly kind: 'live' | 'snapshot' | 'synthetic';
  readonly sourceId: string;
  readonly sourceUrl: string | null;
  readonly fetchedAt: string;
  readonly validUntil: string | null;
  readonly license: string | null;
  readonly licenseUrl: string | null;
  readonly attribution: string | null;
}
