import type { AuditDetails } from './audit-entry';

/** The kinds of things of a website an entry can name by id. Closed: a new one is added here on purpose. */
export const AUDIT_SUBJECT_KINDS = [
  'page',
  'map',
  'dataSource',
  'dataset',
  'release',
  'migration',
  'service',
  'location',
  'resource',
  'booking',
  'member',
  'invitation',
] as const;
export type AuditSubjectKind = (typeof AUDIT_SUBJECT_KINDS)[number];

/**
 * The detail fields that name a thing by id, and what they name. The modules
 * share these field names in their events, so one table reads them all; a
 * field not listed here is a plain value (a count, a code, a list of names).
 */
export const AUDIT_SUBJECT_FIELDS = {
  pageId: 'page',
  mapId: 'map',
  dataSourceId: 'dataSource',
  datasetId: 'dataset',
  releaseId: 'release',
  previousReleaseId: 'release',
  sourceReleaseId: 'release',
  migrationId: 'migration',
  serviceId: 'service',
  locationId: 'location',
  resourceId: 'resource',
  bookingId: 'booking',
  subjectId: 'member',
  memberId: 'member',
  invitationId: 'invitation',
} as const satisfies Readonly<Record<string, AuditSubjectKind>>;

/** What a detail field names, or `null` for a plain value. */
export function subjectKindOf(field: string): AuditSubjectKind | null {
  return Object.hasOwn(AUDIT_SUBJECT_FIELDS, field)
    ? AUDIT_SUBJECT_FIELDS[field as keyof typeof AUDIT_SUBJECT_FIELDS]
    : null;
}

/** The ids some entries name, per kind, each once: what a screen looks up to name them. Kinds no entry names are absent. */
export type AuditSubjectIds = ReadonlyMap<AuditSubjectKind, readonly string[]>;

export function subjectIdsOf(
  entries: ReadonlyArray<{ readonly details: AuditDetails }>,
): AuditSubjectIds {
  const found = new Map<AuditSubjectKind, Set<string>>();
  for (const { details } of entries) {
    for (const [field, value] of Object.entries(details)) {
      const kind = subjectKindOf(field);
      if (kind !== null && typeof value === 'string' && value !== '') {
        let ids = found.get(kind);
        if (ids === undefined) {
          ids = new Set<string>();
          found.set(kind, ids);
        }
        ids.add(value);
      }
    }
  }
  return new Map(Array.from(found, ([kind, ids]) => [kind, Array.from(ids)]));
}
