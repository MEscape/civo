import { AlertTriangle, Info } from '@components/icons/icons';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { buildQueryString, cn } from '@lib/utils';

import { auditParamsOf } from '../schemas/audit-filter-schema';

import { Fact, FactValue } from './audit-fact-value';

import type { AuditEntryView, AuditFilter } from '../../application/contracts/audit-views';
import type { EntryContext, EntryDescription } from '../entries/audit-entry-context';

/**
 * How serious an entry is, as a small tinted icon ahead of its name: an
 * information or a warning. The icon differs too, so colour is never the
 * only signal, and its name is read out.
 */
export function SeverityMark({
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
        'flex size-6 shrink-0 items-center justify-center rounded-full border',
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

/** The two questions an entry raises, as links: what else did this person do, and how often did this happen. */
function EntryActions({
  entry,
  ctx,
  described,
}: {
  readonly entry: AuditEntryView;
  readonly ctx: EntryContext;
  readonly described: EntryDescription;
}) {
  const { t, pathname, filter, websiteAuditHref } = ctx;
  const hrefWith = (narrowed: Partial<AuditFilter>) =>
    `${pathname}${buildQueryString(auditParamsOf({ ...filter, ...narrowed }))}`;

  return (
    <p className="flex flex-wrap gap-2">
      {entry.actorKind === 'member' && entry.actorId !== null && (
        <Link
          href={hrefWith({ actor: { kind: 'member', id: entry.actorId } })}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          {t('list.byActor', { name: described.actor })}
        </Link>
      )}
      <Link
        href={hrefWith({ source: entry.source, type: entry.type })}
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
      >
        {t('list.byEvent', { label: described.label })}
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
  );
}

/** Everything an entry recorded, each value named and the things it refers to linked by their current names. */
export function EntryDetails({
  entry,
  ctx,
  described,
}: {
  readonly entry: AuditEntryView;
  readonly ctx: EntryContext;
  readonly described: EntryDescription;
}) {
  const { t, format, names, websites } = ctx;
  const { actor, facts, websiteName } = described;

  return (
    <div className="space-y-4 bg-canvas p-4 text-sm">
      <dl
        aria-label={t('list.details')}
        className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2"
      >
        <Fact label={t('details.when')}>{format.dateTime(entry.occurredAt)}</Fact>
        <Fact label={t('details.who')}>{actor}</Fact>
        {websiteName !== null && <Fact label={t('details.website')}>{websiteName}</Fact>}
        {facts.map((fact) => (
          <Fact key={fact.field} label={fact.label === null ? fact.field : t(fact.label)}>
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
      <EntryActions entry={entry} ctx={ctx} described={described} />
    </div>
  );
}
