import { DataPanel } from '@components/shared/data-panel';
import { Pagination } from '@components/shared/pagination';
import { ResponsiveTable } from '@components/shared/responsive-table';
import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { TableRowDetailsTrigger } from '@components/shared/table-row-details';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import type { Page } from '@lib/pagination';

import { teamListHref } from '../../forms/team-list';
import { createZonedFormat } from '../../hooks/use-zoned-format';
import { bookingRoutes } from '../../routes';
import { NameTile } from '../shared/name-tile';

import { TeamEmpty } from './team-empty';
import { TeamFilters } from './team-filters';
import { TeamRowActions } from './team-row-actions.client';
import { TeamRowDetails } from './team-row-details';
import { weekLines, weekSummary } from './team-week';

import type { LocationNameDto } from '../../dto/service-dto';
import type { TeamMemberSummaryDto } from '../../dto/team-dto';
import type { TeamListView } from '../../forms/team-list';

export interface TeamListProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly location: { readonly id: string; readonly name: string };
  readonly page: Page<TeamMemberSummaryDto>;
  readonly view: TeamListView;
  readonly qualifications: readonly string[];
  /** Members with the role "Employee" who have no calendar yet: "Add employee" sets them up. */
  readonly candidateCount: number;
  /** The other locations a member can be moved to from their row. */
  readonly moveTargets: readonly LocationNameDto[];
  /** Where members and their roles are managed, for someone who may open it. */
  readonly usersHref?: string | undefined;
}

/**
 * The employees of a location in the table every list of the module is: who, when they work, what
 * they are qualified for, how many absences they have entered, and whether they have seen the last
 * change a manager made. A row opens to the whole week and the absences; "Edit" opens the calendar.
 * The filters are the address, so a view can be shared and survives a reload.
 */
export async function TeamList({
  locale,
  websiteId,
  location,
  page,
  view,
  qualifications,
  candidateCount,
  moveTargets,
  usersHref,
}: TeamListProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const zoned = createZonedFormat(locale);
  const base = bookingRoutes.locationTeam(websiteId, location.id);
  const empty = await TeamEmpty({
    locale,
    resetHref: base,
    isFiltered: view.search !== undefined || view.qualification !== undefined,
    candidateCount,
    usersHref,
  });

  const columns: ReadonlyArray<ResponsiveColumn<TeamMemberSummaryDto>> = [
    {
      id: 'name',
      label: t('team.list.columns.name'),
      isTitle: true,
      width: '@3xl:w-1/4',
      cell: (member) => (
        <div className="flex min-w-0 items-center gap-2">
          <NameTile name={member.name} className="size-8 text-sm" />
          <TableRowDetailsTrigger label={member.name} />
        </div>
      ),
    },
    {
      id: 'week',
      label: t('team.list.columns.week'),
      width: '@3xl:w-1/4',
      cell: (member) => (
        <span className="text-sm text-copy">{weekSummary(weekLines(t, member.weekly))}</span>
      ),
    },
    {
      id: 'qualifications',
      label: t('team.list.columns.qualifications'),
      cell: (member) =>
        member.qualifications.length === 0 ? (
          <span className="text-copy-muted">{t('team.list.noQualifications')}</span>
        ) : (
          member.qualifications.join(', ')
        ),
    },
    {
      id: 'absences',
      label: t('team.list.columns.absences'),
      width: '@3xl:w-28',
      cell: (member) => t('team.list.absenceCount', { count: member.absences.length }),
    },
    {
      id: 'actions',
      label: t('team.list.edit'),
      isAction: true,
      cell: (member) => (
        <TeamRowActions
          subject={{
            websiteId,
            id: member.id,
            name: member.name,
            version: member.version,
            locationId: location.id,
          }}
          editHref={bookingRoutes.teamMember(websiteId, location.id, member.id)}
          moveTargets={moveTargets}
        />
      ),
    },
  ];

  return (
    <DataPanel
      title={t('team.list.title', { location: location.name })}
      meta={t('team.list.count', { count: page.total })}
      footer={
        page.pageCount > 1 ? (
          <Pagination
            locale={locale}
            slice={page}
            hrefFor={(target) => teamListHref(base, view, { page: target })}
            label={t('team.list.pagination')}
          />
        ) : undefined
      }
    >
      <TeamFilters locale={locale} base={base} view={view} qualifications={qualifications} />
      <ResponsiveTable
        label={t('team.list.title', { location: location.name })}
        rows={page.items}
        rowKey={(member) => member.id}
        columns={columns}
        density="standard"
        rowDetails={(member) => <TeamRowDetails t={t} zoned={zoned} member={member} />}
        state={{
          kind: 'ready',
          empty,
        }}
      />
    </DataPanel>
  );
}
