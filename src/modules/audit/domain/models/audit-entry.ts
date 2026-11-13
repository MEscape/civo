import type { ActorId, WebsiteId } from './ids';

/** The modules that keep a trail, as the areas a reader filters by. Closed: a new one is added here on purpose. */
export const AUDIT_SOURCES = [
  'website',
  'builder',
  'release',
  'booking',
  'data-sources',
  'auth',
  'media',
  'map',
] as const;
export type AuditSource = (typeof AUDIT_SOURCES)[number];

/** `warn` marks failures, denials and security signals, as each module's log levels already do. */
export type AuditSeverity = 'info' | 'warn';

/**
 * Who caused an entry: a signed-in member (named by id only), an anonymous
 * visitor of the public site, or the system itself (a start-up task, a sweep).
 */
export type AuditActor =
  | { readonly kind: 'member'; readonly id: ActorId }
  | { readonly kind: 'visitor' }
  | { readonly kind: 'system' };

export type AuditActorKind = AuditActor['kind'];

/** What an event carries besides its type: ids, counts, codes and lists of field names; never content. */
export type AuditDetailValue = string | number | boolean | null | readonly string[];
export type AuditDetails = Readonly<Record<string, AuditDetailValue>>;

/** Event ingestion and persistence reads accept the same plain detail values. */
export function isAuditDetailValue(value: unknown): value is AuditDetailValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

/** One recorded event of one website. */
export interface AuditEntry {
  readonly id: string;
  readonly websiteId: WebsiteId;
  readonly source: AuditSource;
  readonly type: string;
  readonly severity: AuditSeverity;
  readonly actor: AuditActor;
  readonly details: AuditDetails;
  readonly occurredAt: Date;
}

export type NewAuditEntry = Omit<AuditEntry, 'id'>;
