import { addDays } from '@lib/utils/date';

import { factsOf, headlineOf } from './audit-details';
import { SOURCE_MESSAGE_KEYS, actorLabel } from './audit-labels';

import type { AuditFact } from './audit-details';
import type {
  AuditEntryView,
  AuditFilter,
  AuditSubjects,
} from '../../application/contracts/audit-views';
import type { AppFormatters, AuditTranslator } from '../translation/translator';

/** What every entry of a list is drawn from: the words, the formats and the lookups of the whole trail. */
export interface EntryContext {
  readonly t: AuditTranslator;
  readonly format: AppFormatters;
  readonly pathname: string;
  readonly filter: AuditFilter;
  readonly eventLabels: Readonly<Record<string, string>>;
  readonly names: Readonly<Record<string, string>> | null;
  readonly subjects: AuditSubjects;
  readonly websites?: ReadonlyArray<{ readonly id: string; readonly name: string }> | undefined;
  readonly websiteAuditHref?: ((websiteId: string) => string) | undefined;
  /** When the trail was read: "today" and "yesterday" are measured from it. */
  readonly readAt: Date;
}

/** One entry as the words its row and its details show. */
export interface EntryDescription {
  readonly label: string;
  readonly actor: string;
  readonly area: string;
  readonly facts: readonly AuditFact[];
  /** In the platform-wide trail, the website the entry belongs to; otherwise `null`. */
  readonly websiteName: string | null;
  readonly headline: string | null;
  readonly when: string;
}

/** The day an entry belongs to, as the heading over its rows: "Today", "Yesterday" or the date. */
export function dayHeadingOf(entry: AuditEntryView, { t, format, readAt }: EntryContext): string {
  const day = format.date(entry.occurredAt);
  if (day === format.date(readAt)) {
    return t('details.today');
  }
  return day === format.date(addDays(readAt, -1)) ? t('details.yesterday') : day;
}

/** Whether two entries happened on the same day of the reader's calendar. */
export function isSameDay(a: AuditEntryView, b: AuditEntryView, { format }: EntryContext): boolean {
  return format.date(a.occurredAt) === format.date(b.occurredAt);
}

/** An entry's words: what happened, who did it, where, about what, and at what time of its day (the day is the row group's heading). */
export function describeEntry(entry: AuditEntryView, ctx: EntryContext): EntryDescription {
  const { t, format, eventLabels, names, subjects, websites } = ctx;
  const facts = factsOf(entry.details, subjects);

  return {
    label: eventLabels[entry.type] ?? entry.type,
    actor: actorLabel(t, entry, names),
    area: t(SOURCE_MESSAGE_KEYS[entry.source]),
    facts,
    websiteName:
      websites === undefined
        ? null
        : (websites.find((website) => website.id === entry.websiteId)?.name ?? entry.websiteId),
    headline: headlineOf(facts),
    when: format.date(entry.occurredAt, { timeStyle: 'short' }),
  };
}
