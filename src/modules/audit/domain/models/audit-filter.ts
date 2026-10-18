import type { AuditActorKind, AuditSource } from './audit-entry';

/** How far back the trail is read. Relative to now, so a shared address keeps meaning "the last week". */
export const AUDIT_PERIODS = ['24h', '7d', '30d', '90d', 'all'] as const;
export type AuditPeriod = (typeof AUDIT_PERIODS)[number];

export const DEFAULT_AUDIT_PERIOD: AuditPeriod = '30d';

const HOUR_MS = 3_600_000;

const PERIOD_HOURS = {
  '24h': 24,
  '7d': 168,
  '30d': 720,
  '90d': 2160,
  all: null,
} as const satisfies Record<AuditPeriod, number | null>;

/** Whose entries a reader wants: one member by the id the address carries (unchecked), all visitors, or the system. */
export type AuditActorFilter =
  | { readonly kind: Extract<AuditActorKind, 'member'>; readonly id: string }
  | { readonly kind: Exclude<AuditActorKind, 'member'> };

/** What a reader narrows the trail to. Every part is optional except the period, which has a default. */
export interface AuditFilter {
  /** Only this website's entries, for the platform-wide trail; a website's own trail ignores it. Unchecked: the query parses it. */
  readonly websiteId: string | null;
  readonly source: AuditSource | null;
  readonly type: string | null;
  readonly actor: AuditActorFilter | null;
  readonly period: AuditPeriod;
  readonly onlyWarnings: boolean;
}

export const EMPTY_AUDIT_FILTER: AuditFilter = {
  websiteId: null,
  source: null,
  type: null,
  actor: null,
  period: DEFAULT_AUDIT_PERIOD,
  onlyWarnings: false,
};

/** The first instant the period covers, or `null` for the whole trail. */
export function sinceOf(period: AuditPeriod, now: Date): Date | null {
  const hours = PERIOD_HOURS[period];
  return hours === null ? null : new Date(now.getTime() - hours * HOUR_MS);
}
