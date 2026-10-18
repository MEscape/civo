import type { ReactNode } from 'react';

import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { Badge } from '@components/ui/badge';
import { buttonVariants } from '@components/ui/button';
import { AlertTriangle, ArrowRight, ChevronDown, Info, Search } from '@components/ui/icons';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { buildQueryString, cn } from '@lib/utils';

import { auditParamsOf } from '../schemas/audit-filter-schema';

import { changedFieldKey, factsOf, headlineOf } from './audit-details';
import { SOURCE_MESSAGE_KEYS, actorLabel } from './audit-labels';

import type { AuditFact } from './audit-details';
import type {
  AuditEntryView,
  AuditFilter,
  AuditSubjects,
} from '../../application/contracts/audit-views';

type Translator = Awaited<ReturnType<typeof getTranslations<'audit'>>>;
type Formatters = Awaited<ReturnType<typeof getAppFormatters>>;

export interface AuditEntryListProps {
  readonly locale: Locale;
  readonly pathname: string;
  readonly filter: AuditFilter;
  readonly entries: readonly AuditEntryView[];
  /** Every entry that matches, not only this page. */
  readonly total: number;
  /** Whether a filter narrows the trail: an empty list then means "no match", not "nothing yet". */
  readonly isFiltered: boolean;
  readonly eventLabels: Readonly<Record<string, string>>;
  /** Names by actor id, for the people who acted and the people an entry concerns; `null` without sign-in. */
  readonly names: Readonly<Record<string, string>> | null;
  /** The pages, data and bookings the entries name, as far as the reader may see them. */
  readonly subjects: AuditSubjects;
  /**
   * The websites by id, in the platform-wide trail: each entry then names its
   * website, and what it refers to is shown by id (names are looked up within one website).
   */
  readonly websites?: ReadonlyArray<{ readonly id: string; readonly name: string }> | undefined;
  /** Where one website's own trail is: its page names what this one shows by id. */
  readonly websiteAuditHref?: ((websiteId: string) => string) | undefined;
  /** When the trail was read: "today" and "5 minutes ago" are measured from it. */
  readonly readAt: Date;
  /** The filters, drawn as a strip between the panel's header and the entries. */
  readonly toolbar?: ReactNode;
  /** The page links, drawn in the panel's footer. */
  readonly pagination?: ReactNode;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How serious an entry is, as a small tinted icon ahead of its name: an
 * information or a warning. The icon differs too, so colour is never the
 * only signal, and its name is read out.
 */
function SeverityMark({
  severity,
  label,
}: {
  readonly severity: AuditEntryView['severity'];
  readonly label: string;
}) {
  const isWarning = severity === 'warn';
  const Icon = isWarning ? AlertTriangle : Info;
  return (
    <span
      title={label}
      className={cn(
        'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border',
        isWarning
          ? 'border-warning-border bg-warning-subtle text-warning'
          : 'border-info-border bg-info-subtle text-info',
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** A thing an entry names: linked by name where the reader may go, else named, gone, or not theirs to see. */
function SubjectValue({
  t,
  fact,
  names,
  showIds,
}: {
  readonly t: Translator;
  readonly fact: Extract<AuditFact, { kind: 'subject' }>;
  readonly names: Readonly<Record<string, string>> | null;
  readonly showIds: boolean;
}) {
  if (fact.subject === 'member') {
    return names?.[fact.id] ?? t(names === null ? 'actors.member' : 'actors.formerMember');
  }
  const { view } = fact;
  if (view === null && showIds) {
    return (
      <code className="rounded-token-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-xs break-all">
        {fact.id}
      </code>
    );
  }
  if (view === null) {
    return <span className="text-copy-muted">{t('details.hidden')}</span>;
  }
  if (view.state === 'gone') {
    return <Badge variant="muted">{t('details.gone')}</Badge>;
  }
  const text =
    view.name ??
    (fact.number === null ? t('details.view') : t('details.release', { number: fact.number }));
  return view.href === null ? (
    text
  ) : (
    <Link
      href={view.href}
      className="inline-flex items-center gap-1 font-medium text-copy underline-offset-4 hover:underline"
    >
      {text}
      <ArrowRight className="size-3.5 text-copy-muted" aria-hidden="true" />
    </Link>
  );
}

/** One value of an entry's details, as its kind reads best. */
function FactValue({
  t,
  format,
  fact,
  names,
  showIds,
}: {
  readonly t: Translator;
  readonly showIds: boolean;
  readonly format: Formatters;
  readonly fact: AuditFact;
  readonly names: Readonly<Record<string, string>> | null;
}) {
  switch (fact.kind) {
    case 'subject':
      return <SubjectValue t={t} fact={fact} names={names} showIds={showIds} />;
    case 'value':
      return fact.tone === null ? (
        t(fact.value)
      ) : (
        <Badge variant={fact.tone}>{t(fact.value)}</Badge>
      );
    case 'changed':
      return (
        <ul className="flex flex-wrap gap-1">
          {fact.names.map((name) => {
            const key = changedFieldKey(name);
            return (
              <li key={name}>
                <Badge variant="outline">{key === null ? name : t(key)}</Badge>
              </li>
            );
          })}
        </ul>
      );
    case 'number':
      return <span className="tabular-nums">{format.number(fact.value)}</span>;
    case 'boolean':
      return t(fact.value ? 'details.yes' : 'details.no');
    case 'code':
      return (
        <code className="rounded-token-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-xs">
          {fact.value}
        </code>
      );
    case 'text':
      return fact.value;
  }
}

function Fact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs text-copy-muted">{label}</dt>
      <dd className="break-words text-sm text-copy">{children}</dd>
    </div>
  );
}

/** The entries in days, newest first: each day once, as a heading over its entries. */
function byDay(
  entries: readonly AuditEntryView[],
  dayOf: (date: Date) => string,
): ReadonlyArray<{ readonly day: string; readonly entries: readonly AuditEntryView[] }> {
  const days: Array<{ day: string; entries: AuditEntryView[] }> = [];
  for (const entry of entries) {
    const day = dayOf(entry.occurredAt);
    const last = days.at(-1);
    if (last?.day === day) {
      last.entries.push(entry);
    } else {
      days.push({ day, entries: [entry] });
    }
  }
  return days;
}

/**
 * The trail as a list in days, newest first. Each entry is one line (what,
 * about what, who, in which area, when) that opens to everything it recorded,
 * each value named and the things it refers to linked by their current
 * names, and to the two questions an entry raises: what else did this person
 * do, and how often did this happen. Server-rendered: opening needs no script.
 */
export async function AuditEntryList({
  locale,
  pathname,
  filter,
  entries,
  total,
  isFiltered,
  eventLabels,
  names,
  subjects,
  websites,
  websiteAuditHref,
  readAt,
  toolbar,
  pagination,
}: AuditEntryListProps) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'audit' }),
    getAppFormatters(),
  ]);

  const hrefWith = (narrowed: Partial<AuditFilter>) =>
    `${pathname}${buildQueryString(auditParamsOf({ ...filter, ...narrowed }))}`;
  const websiteNameOf = (id: string) =>
    websites === undefined ? null : (websites.find((website) => website.id === id)?.name ?? id);
  const dayOf = (date: Date) => format.date(date);
  const today = dayOf(readAt);
  const yesterday = dayOf(new Date(readAt.getTime() - DAY_MS));
  const dayLabel = (day: string) => {
    if (day === today) {
      return t('details.today');
    }
    return day === yesterday ? t('details.yesterday') : day;
  };

  return (
    <DataPanel title={t('list.title')} meta={t('list.count', { count: total })} footer={pagination}>
      {toolbar}
      {entries.length === 0 ? (
        <EmptyState
          className="py-10"
          icon={<Search className="size-6" aria-hidden="true" />}
          title={isFiltered ? t('list.noMatch') : t('list.empty')}
        />
      ) : (
        <ul aria-label={t('list.label')}>
          {byDay(entries, dayOf).map(({ day, entries: ofDay }) => (
            <li key={day}>
              <h3 className="border-b border-border bg-canvas px-4 py-1.5 text-xs font-semibold text-copy-muted">
                {dayLabel(day)}
              </h3>
              <ul className="divide-y divide-border border-b border-border">
                {ofDay.map((entry) => {
                  const label = eventLabels[entry.type] ?? entry.type;
                  const actor = actorLabel(t, entry, names);
                  const area = t(SOURCE_MESSAGE_KEYS[entry.source]);
                  const facts = factsOf(entry.details, subjects);
                  const websiteName = websiteNameOf(entry.websiteId);
                  const headline = headlineOf(facts);
                  const when =
                    day === today
                      ? format.relativeTime(entry.occurredAt, readAt)
                      : format.date(entry.occurredAt, { hour: '2-digit', minute: '2-digit' });

                  return (
                    <li key={entry.id}>
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
                          <SeverityMark
                            severity={entry.severity}
                            label={t(`list.severity.${entry.severity}`)}
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                              <span className="font-medium text-copy">{label}</span>
                              {headline !== null && (
                                <span className="max-w-full truncate rounded-token-sm bg-canvas px-1.5 text-copy-muted group-hover:bg-surface">
                                  {headline}
                                </span>
                              )}
                            </p>
                            <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-copy-muted">
                              <span className="truncate">{actor}</span>
                              <span aria-hidden="true">·</span>
                              <span>{area}</span>
                              {websiteName !== null && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate font-medium text-copy">
                                    {websiteName}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                          <time
                            dateTime={entry.occurredAt.toISOString()}
                            title={format.dateTime(entry.occurredAt)}
                            className="shrink-0 pt-0.5 text-xs whitespace-nowrap text-copy-muted tabular-nums"
                          >
                            {when}
                          </time>
                          <ChevronDown
                            className="mt-0.5 size-4 shrink-0 text-copy-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
                            aria-hidden="true"
                          />
                        </summary>
                        <div className="space-y-4 border-t border-border bg-canvas px-4 py-4 sm:pl-13">
                          <dl
                            aria-label={t('list.details')}
                            className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2"
                          >
                            <Fact label={t('details.when')}>
                              {format.dateTime(entry.occurredAt)}
                            </Fact>
                            <Fact label={t('details.who')}>{actor}</Fact>
                            {websiteName !== null && (
                              <Fact label={t('details.website')}>{websiteName}</Fact>
                            )}
                            {facts.map((fact) => (
                              <Fact
                                key={fact.field}
                                label={fact.label === null ? fact.field : t(fact.label)}
                              >
                                <FactValue
                                  t={t}
                                  format={format}
                                  fact={fact}
                                  names={names}
                                  showIds={websites !== undefined}
                                />
                              </Fact>
                            ))}
                          </dl>
                          <p className="flex flex-wrap gap-2">
                            {entry.actorKind === 'member' && entry.actorId !== null && (
                              <Link
                                href={hrefWith({ actor: { kind: 'member', id: entry.actorId } })}
                                className={buttonVariants({ variant: 'outline', size: 'sm' })}
                              >
                                {t('list.byActor', { name: actor })}
                              </Link>
                            )}
                            <Link
                              href={hrefWith({ source: entry.source, type: entry.type })}
                              className={buttonVariants({ variant: 'outline', size: 'sm' })}
                            >
                              {t('list.byEvent', { label })}
                            </Link>
                            {websiteAuditHref !== undefined && (
                              <Link
                                href={`${websiteAuditHref(entry.websiteId)}${buildQueryString({ event: entry.type, period: 'all' })}`}
                                className={buttonVariants({ variant: 'outline', size: 'sm' })}
                              >
                                {t('list.inWebsite')}
                              </Link>
                            )}
                          </p>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </DataPanel>
  );
}
