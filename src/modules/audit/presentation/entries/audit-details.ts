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
  mapId: 'details.fields.mapId',
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
  roles: 'details.fields.roles',
  previousRoles: 'details.fields.previousRoles',
  removedRoles: 'details.fields.removedRoles',
  role: 'details.fields.role',
  assetId: 'details.fields.assetId',
  byteSize: 'details.fields.byteSize',
  visibility: 'details.fields.visibility',
  how: 'details.fields.how',
  leftOpen: 'details.fields.leftOpen',
  sections: 'details.fields.sections',
  parts: 'details.fields.parts',
  memberId: 'details.fields.memberId',
  scope: 'details.fields.scope',
  cancelled: 'details.fields.cancelled',
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
    size: { key: 'details.values.reason.size', tone: 'danger' },
    content_type: { key: 'details.values.reason.contentType', tone: 'danger' },
    signature: { key: 'details.values.reason.signature', tone: 'danger' },
  },
  role: {
    admin: { key: 'details.values.role.admin', tone: null },
    editor: { key: 'details.values.role.editor', tone: null },
    contributor: { key: 'details.values.role.contributor', tone: null },
    viewer: { key: 'details.values.role.viewer', tone: null },
    employee: { key: 'details.values.role.employee', tone: null },
    platform_admin: { key: 'details.values.role.platformAdmin', tone: null },
  },
  how: {
    claim: { key: 'details.values.how.claim', tone: null },
    assign: { key: 'details.values.how.assign', tone: null },
    copy: { key: 'details.values.how.copy', tone: null },
    link: { key: 'details.values.how.link', tone: null },
  },
  visibility: {
    public: { key: 'details.values.visibility.public', tone: null },
    private: { key: 'details.values.visibility.private', tone: null },
  },
  scope: {
    location: { key: 'details.values.scope.location', tone: null },
    all: { key: 'details.values.scope.all', tone: null },
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

type ListWordKey = Extract<ValidKeys, `details.values.${'role' | 'section'}.${string}`>;

const ROLE_WORDS = {
  admin: 'details.values.role.admin',
  editor: 'details.values.role.editor',
  contributor: 'details.values.role.contributor',
  viewer: 'details.values.role.viewer',
  employee: 'details.values.role.employee',
  platform_admin: 'details.values.role.platformAdmin',
} as const satisfies Readonly<Record<string, ListWordKey>>;

const SECTION_WORDS = {
  details: 'details.values.section.details',
  hours: 'details.values.section.hours',
  status: 'details.values.section.status',
  availability: 'details.values.section.availability',
  shared: 'details.values.section.shared',
  local: 'details.values.section.local',
  setup: 'details.values.section.setup',
  absences: 'details.values.section.absences',
  qualifications: 'details.values.section.qualifications',
} as const satisfies Readonly<Record<string, ListWordKey>>;

/** The fields that hold a list of codes, each code with its name; a code not listed is shown as it is. */
const DETAIL_LIST_WORDS: Readonly<Record<string, Readonly<Record<string, ListWordKey>>>> = {
  roles: ROLE_WORDS,
  previousRoles: ROLE_WORDS,
  removedRoles: ROLE_WORDS,
  sections: SECTION_WORDS,
  parts: SECTION_WORDS,
};

export type DetailFieldKey = (typeof DETAIL_FIELD_KEYS)[keyof typeof DETAIL_FIELD_KEYS];
interface ValueWord {
  readonly key: ValueKey;
  readonly tone: ValueTone;
}

function lookup<T>(table: Readonly<Record<string, T>>, key: string): T | null {
  return Object.hasOwn(table, key) ? (table[key] ?? null) : null;
}

type ListItemKey = ListWordKey | (typeof CHANGED_FIELD_KEYS)[keyof typeof CHANGED_FIELD_KEYS];

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
  | {
      readonly kind: 'list';
      readonly items: ReadonlyArray<{ readonly text: string; readonly key: ListItemKey | null }>;
    }
  | { readonly kind: 'bytes'; readonly value: number }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'boolean'; readonly value: boolean }
  | { readonly kind: 'code'; readonly value: string }
  | { readonly kind: 'text'; readonly value: string }
);

/** Fields shown as part of another one (a release's number), or with nothing to show (an invitation's id). */
const FOLDED_FIELDS: ReadonlySet<string> = new Set(['releaseNumber', 'invitationId']);

/** Codes and identifiers read best set in a fixed-width face. */
const CODE_FIELDS: ReadonlySet<string> = new Set([
  'assetId',
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
    return field === 'byteSize'
      ? { field, label, kind: 'bytes', value }
      : { field, label, kind: 'number', value };
  }
  if (typeof value === 'boolean') {
    return { field, label, kind: 'boolean', value };
  }
  const words = lookup(DETAIL_LIST_WORDS, field) ?? CHANGED_FIELD_KEYS;
  return {
    field,
    label,
    kind: 'list',
    items: value.map((text) => ({ text, key: lookup<ListItemKey>(words, text) })),
  };
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
