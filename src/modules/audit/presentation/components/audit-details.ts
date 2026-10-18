import { subjectKindOf } from '../../application/contracts/audit-views';

import type {
  AuditDetails,
  AuditSubjectKind,
  AuditSubjects,
  AuditSubjectView,
} from '../../application/contracts/audit-views';
import type { ValidKeys } from '../messages/message-keys';

/** What each detail field is called; a field not listed is shown by its own name. */
export const DETAIL_FIELD_KEYS = {
  pageId: 'details.fields.pageId',
  dataSourceId: 'details.fields.dataSourceId',
  datasetId: 'details.fields.datasetId',
  releaseId: 'details.fields.releaseId',
  previousReleaseId: 'details.fields.previousReleaseId',
  sourceReleaseId: 'details.fields.sourceReleaseId',
  migrationId: 'details.fields.migrationId',
  serviceId: 'details.fields.serviceId',
  locationId: 'details.fields.locationId',
  resourceId: 'details.fields.resourceId',
  bookingId: 'details.fields.bookingId',
  subjectId: 'details.fields.subjectId',
  version: 'details.fields.version',
  nodeCount: 'details.fields.nodeCount',
  canonicalKind: 'details.fields.canonicalKind',
  kind: 'details.fields.kind',
  outcome: 'details.fields.outcome',
  errorCode: 'details.fields.errorCode',
  changedFields: 'details.fields.changedFields',
  fields: 'details.fields.fields',
  releaseNumber: 'details.fields.releaseNumber',
  writtenPageCount: 'details.fields.writtenPageCount',
  unresolvableCount: 'details.fields.unresolvableCount',
  skippedNodeCount: 'details.fields.skippedNodeCount',
  needsReviewCount: 'details.fields.needsReviewCount',
  failedPageCount: 'details.fields.failedPageCount',
  divergedPageCount: 'details.fields.divergedPageCount',
  templateKey: 'details.fields.templateKey',
  retentionDays: 'details.fields.retentionDays',
  deletedCount: 'details.fields.deletedCount',
  by: 'details.fields.by',
  stage: 'details.fields.stage',
  skipped: 'details.fields.skipped',
  created: 'details.fields.created',
  count: 'details.fields.count',
  reason: 'details.fields.reason',
  permission: 'details.fields.permission',
  action: 'details.fields.action',
} as const satisfies Readonly<Record<string, Extract<ValidKeys, `details.fields.${string}`>>>;

type ValueTone = 'success' | 'danger' | null;
type ValueKey = Extract<ValidKeys, `details.values.${string}.${string}`>;

/** The fields whose value is one of a few words, each with its name and how it reads. */
const DETAIL_VALUE_KEYS = {
  outcome: {
    OK: { key: 'details.values.outcome.ok', tone: 'success' },
    ERROR: { key: 'details.values.outcome.error', tone: 'danger' },
  },
  by: {
    customer: { key: 'details.values.by.customer', tone: null },
    staff: { key: 'details.values.by.staff', tone: null },
  },
  stage: {
    hold: { key: 'details.values.stage.hold', tone: null },
    confirm: { key: 'details.values.stage.confirm', tone: null },
    reschedule: { key: 'details.values.stage.reschedule', tone: null },
  },
  reason: {
    tenant_mismatch: { key: 'details.values.reason.tenantMismatch', tone: 'danger' },
    permission_missing: { key: 'details.values.reason.permissionMissing', tone: 'danger' },
  },
} as const satisfies Readonly<
  Record<string, Readonly<Record<string, { key: ValueKey; tone: ValueTone }>>>
>;

/** The names of the fields an edit can change, for "changed: name, description". */
export const CHANGED_FIELD_KEYS = {
  name: 'details.changed.name',
  description: 'details.changed.description',
  slug: 'details.changed.slug',
  path: 'details.changed.path',
} as const satisfies Readonly<Record<string, Extract<ValidKeys, `details.changed.${string}`>>>;

export type DetailFieldKey = (typeof DETAIL_FIELD_KEYS)[keyof typeof DETAIL_FIELD_KEYS];
interface ValueWord {
  readonly key: ValueKey;
  readonly tone: ValueTone;
}

function lookup<T>(table: Readonly<Record<string, T>>, key: string): T | null {
  return Object.hasOwn(table, key) ? (table[key] ?? null) : null;
}

/** One line of an entry's details, ready to show; labels are message keys or, for unknown fields, the field itself. */
export type AuditFact = { readonly field: string; readonly label: DetailFieldKey | null } & (
  | {
      readonly kind: 'subject';
      readonly subject: AuditSubjectKind;
      readonly id: string;
      /** `null` when the reader may not see that area; `found` may still carry no name (a release). */
      readonly view: AuditSubjectView | null;
      /** A release names itself by the number its entry carries. */
      readonly number: number | null;
    }
  | { readonly kind: 'value'; readonly value: ValueKey; readonly tone: ValueTone }
  | { readonly kind: 'changed'; readonly names: readonly string[] }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'boolean'; readonly value: boolean }
  | { readonly kind: 'code'; readonly value: string }
  | { readonly kind: 'text'; readonly value: string }
);

/** Fields shown as part of another one (a release's number), or with nothing to show (an invitation's id). */
const FOLDED_FIELDS: ReadonlySet<string> = new Set(['releaseNumber', 'invitationId']);

/** Codes and identifiers read best set in a fixed-width face. */
const CODE_FIELDS: ReadonlySet<string> = new Set([
  'errorCode',
  'permission',
  'action',
  'templateKey',
]);

type DetailValue = NonNullable<AuditDetails[string]>;

/** A text value: a word the screen translates when it knows the field's vocabulary, else the text as it is. */
function textFact(field: string, label: DetailFieldKey | null, value: string): AuditFact {
  const words = lookup<Readonly<Record<string, ValueWord>>>(DETAIL_VALUE_KEYS, field);
  const known = words === null ? null : lookup(words, value);
  return known === null
    ? { field, label, kind: CODE_FIELDS.has(field) ? 'code' : 'text', value }
    : { field, label, kind: 'value', value: known.key, tone: known.tone };
}

/** One recorded field as a line to show. */
function factOf(
  field: string,
  value: DetailValue,
  { subjects, releaseNumber }: { subjects: AuditSubjects; releaseNumber: number | null },
): AuditFact {
  const label = lookup<DetailFieldKey>(DETAIL_FIELD_KEYS, field);
  const subject = subjectKindOf(field);
  if (subject !== null && typeof value === 'string') {
    return {
      field,
      label,
      kind: 'subject',
      subject,
      id: value,
      view: subjects[subject]?.[value] ?? null,
      number: field === 'releaseId' ? releaseNumber : null,
    };
  }
  if (typeof value === 'string') {
    return textFact(field, label, value);
  }
  if (typeof value === 'number') {
    return { field, label, kind: 'number', value };
  }
  if (typeof value === 'boolean') {
    return { field, label, kind: 'boolean', value };
  }
  return { field, label, kind: 'changed', names: value };
}

/**
 * An entry's details as lines to show, in the order they were recorded:
 * what it names (with the name the reader may see), then its values, each
 * with its name. Empty values (an error code of a success) are left out.
 */
export function factsOf(details: AuditDetails, subjects: AuditSubjects): readonly AuditFact[] {
  const releaseNumber =
    typeof details['releaseNumber'] === 'number' ? details['releaseNumber'] : null;
  return Object.entries(details).flatMap(([field, value]) =>
    value === null || value === '' || FOLDED_FIELDS.has(field)
      ? []
      : [factOf(field, value, { subjects, releaseNumber })],
  );
}

/** The thing an entry is mainly about, for its one-line summary: the first it names that has a name. */
export function headlineOf(facts: readonly AuditFact[]): string | null {
  for (const fact of facts) {
    if (fact.kind === 'subject' && fact.view?.state === 'found' && fact.view.name !== null) {
      return fact.view.name;
    }
  }
  return null;
}

/** The name of a field that an edit changed, or the field itself. */
export function changedFieldKey(
  name: string,
): (typeof CHANGED_FIELD_KEYS)[keyof typeof CHANGED_FIELD_KEYS] | null {
  return lookup(CHANGED_FIELD_KEYS, name);
}
