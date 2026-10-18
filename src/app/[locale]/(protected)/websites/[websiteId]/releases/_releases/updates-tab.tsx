import { HistoryPagination, MigrationPanel, releaseQueries } from '@modules/release';
import { releaseRoutes, toMigrationHistoryDto } from '@modules/release/client';

import { I18nProvider } from '@components/providers/i18n-provider';

import { loadComponentLabels } from '@/app/_lib/component-labels';
import { orFail } from '@/app/_lib/or-fail';
import { loadPublicationStatus } from '@/app/_lib/publication-status';

import type { TabProps } from './tab-props';

export async function UpdatesTab({ websiteId, locale, access, searchParams }: TabProps) {
  const { page, pageSize } = searchParams;
  const [migrations, status] = await Promise.all([
    orFail(releaseQueries.listMigrations.execute(websiteId, { page, pageSize })),
    orFail(loadPublicationStatus(websiteId)),
  ]);
  const updates = status.componentUpdates;
  const historyTypes = migrations.items.flatMap((migration) =>
    (migration.pages ?? []).flatMap((changed) => changed.nodes.map((node) => node.type)),
  );
  const labels = await loadComponentLabels(locale, [
    ...new Set([
      ...(updates?.components.map((component) => component.type) ?? []),
      ...historyTypes,
    ]),
  ]);

  return (
    <I18nProvider locale={locale} namespaces={['release']}>
      <MigrationPanel
        websiteId={websiteId}
        history={toMigrationHistoryDto(migrations.items)}
        historyTotal={migrations.total}
        updates={updates}
        componentLabels={labels}
        checkedAt={status.checkedAt.toISOString()}
        mayRun={access.may('release.publish')}
        pagination={
          migrations.pageCount > 1 ? (
            <HistoryPagination
              locale={locale}
              scope="migrations"
              page={migrations}
              basePath={releaseRoutes.releases(websiteId)}
            />
          ) : undefined
        }
      />
    </I18nProvider>
  );
}
