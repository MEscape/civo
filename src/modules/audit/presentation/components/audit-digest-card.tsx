import {
  OverviewCard,
  OverviewRow,
  OverviewStat,
  OverviewStats,
} from '@components/shared/overview-card';
import { Badge } from '@components/ui/badge';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { AuditActivityChart } from './audit-activity-chart.client';
import { SOURCE_MESSAGE_KEYS, actorLabel } from './audit-labels';

import type { AuditDigestView } from '../../application/contracts/audit-views';

export interface AuditDigestCardProps {
  /** The URL's locale: a page prerenders on its own, so it must not be read from the request. */
  readonly locale: Locale;
  readonly digest: AuditDigestView;
  /** The website's audit page; the website module owns that address. */
  readonly auditHref: string;
  readonly eventLabels: Readonly<Record<string, string>>;
  readonly names: Readonly<Record<string, string>> | null;
}

/** Noon of a UTC day: the same calendar date in every time zone the app formats in. */
const dayInstant = (day: string) => new Date(`${day}T12:00:00Z`);

/**
 * The trail at a glance for the website overview: the month's numbers, a
 * chart of entries per day with the warnings on top, and the newest entries.
 * The chart is the one client part; every text it shows is made here, and the
 * same numbers are a table for assistive technology.
 */
export async function AuditDigestCard({
  locale,
  digest,
  auditHref,
  eventLabels,
  names,
}: AuditDigestCardProps) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'audit' }),
    getAppFormatters(),
  ]);
  const days = digest.days.map((day) => {
    const date = dayInstant(day.day);
    return {
      day: day.day,
      label: format.date(date, { day: 'numeric', month: 'short' }),
      summary: t('overview.daySummary', {
        date: format.date(date),
        total: day.total,
        warnings: day.warnings,
      }),
      others: day.total - day.warnings,
      warnings: day.warnings,
    };
  });

  return (
    <OverviewCard title={t('overview.title')} link={{ href: auditHref, label: t('overview.link') }}>
      <OverviewRow className="space-y-3">
        <OverviewStats>
          <OverviewStat label={t('overview.total')} value={format.number(digest.total)} />
          <OverviewStat
            label={t('overview.warnings')}
            value={format.number(digest.warnings)}
            tone={digest.warnings > 0 ? 'warning' : 'default'}
          />
        </OverviewStats>
        {digest.total > 0 && (
          <>
            <AuditActivityChart
              days={days}
              names={{ others: t('overview.others'), warnings: t('overview.warningSeries') }}
            />
            <ul aria-hidden="true" className="flex gap-4 text-xs text-copy-muted">
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-token-sm bg-chart-1" />
                {t('overview.others')}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-token-sm bg-warning" />
                {t('overview.warningSeries')}
              </li>
            </ul>
            <table className="sr-only">
              <caption>{t('overview.tableCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('overview.day')}</th>
                  <th scope="col">{t('overview.others')}</th>
                  <th scope="col">{t('overview.warningSeries')}</th>
                </tr>
              </thead>
              <tbody>
                {digest.days
                  .filter((day) => day.total > 0)
                  .map((day) => (
                    <tr key={day.day}>
                      <th scope="row">{format.date(dayInstant(day.day))}</th>
                      <td>{day.total}</td>
                      <td>{day.warnings}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}
      </OverviewRow>
      {digest.recent.length === 0 ? (
        <OverviewRow>
          <p className="text-sm text-copy-muted">{t('overview.empty')}</p>
        </OverviewRow>
      ) : (
        <OverviewRow className="space-y-0 p-0">
          <h3 className="px-4 pb-1 pt-3 text-xs font-medium text-copy-muted">
            {t('overview.latest')}
          </h3>
          <ul className="divide-y divide-border">
            {digest.recent.map((entry) => (
              <li key={entry.id} className="space-y-0.5 px-4 py-2.5">
                <p className="flex items-center gap-2 text-sm font-medium text-copy">
                  <span className="truncate">{eventLabels[entry.type] ?? entry.type}</span>
                  {entry.severity === 'warn' && (
                    <Badge variant="warning">{t('list.warning')}</Badge>
                  )}
                </p>
                <p className="flex flex-wrap gap-x-2 text-xs text-copy-muted">
                  <span>{actorLabel(t, entry, names)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t(SOURCE_MESSAGE_KEYS[entry.source])}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={entry.occurredAt.toISOString()}>
                    {format.dateTime(entry.occurredAt)}
                  </time>
                </p>
              </li>
            ))}
          </ul>
        </OverviewRow>
      )}
    </OverviewCard>
  );
}
