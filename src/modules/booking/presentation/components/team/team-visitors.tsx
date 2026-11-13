import { DataPanel } from '@components/shared/data-panel';
import { ResponsiveTable } from '@components/shared/responsive-table';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { createZonedFormat } from '../../hooks/use-zoned-format';
import { bookingRoutes } from '../../routes';

import type { TeamVisitorDto } from '../../dto/team-dto';

export interface TeamVisitorsProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly visitors: readonly TeamVisitorDto[];
}

/**
 * The employees of other locations who work here for some days: who, where they belong and when. Their
 * calendar is changed at their own location, so a row leads there. Nothing is drawn while there are none.
 */
export async function TeamVisitors({ locale, websiteId, visitors }: TeamVisitorsProps) {
  if (visitors.length === 0) {
    return null;
  }
  const t = await getTranslations({ locale, namespace: 'booking' });
  const zoned = createZonedFormat(locale);

  return (
    <DataPanel
      title={t('team.visitors.title')}
      description={t('team.visitors.description')}
      meta={String(visitors.length)}
    >
      <ResponsiveTable
        label={t('team.visitors.label')}
        rows={visitors}
        rowKey={({ id, from }) => `${id}-${from}`}
        density="standard"
        state={{ kind: 'ready', empty: null }}
        columns={[
          {
            id: 'name',
            label: t('team.visitors.columns.name'),
            isTitle: true,
            width: '@3xl:w-1/3',
            cell: ({ name }) => <span className="font-medium text-copy">{name}</span>,
          },
          { id: 'home', label: t('team.visitors.columns.home'), cell: ({ home }) => home.name },
          {
            id: 'period',
            label: t('team.visitors.columns.period'),
            cell: ({ from, to }) =>
              from === to
                ? zoned.calendarDate(from)
                : t('exceptions.range', {
                    from: zoned.calendarDate(from),
                    to: zoned.calendarDate(to),
                  }),
          },
          {
            id: 'open',
            label: t('team.visitors.open'),
            isAction: true,
            cell: ({ id, name, home }) => (
              <div className="flex justify-end">
                <Link
                  href={bookingRoutes.teamMember(websiteId, home.id, id)}
                  aria-label={`${t('team.visitors.open')}: ${name}`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  {t('team.visitors.open')}
                </Link>
              </div>
            ),
          },
        ]}
      />
    </DataPanel>
  );
}
