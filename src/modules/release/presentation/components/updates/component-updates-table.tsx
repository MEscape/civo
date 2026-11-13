import { ResponsiveTable } from '@components/shared/responsive-table';
import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { TableRowDetailsTrigger } from '@components/shared/table-row-details';
import { Badge } from '@components/ui/badge';

import { getTranslations } from '@i18n/server';

import { COMPONENT_UPDATE_MESSAGE_KEYS } from '../../messages/message-keys';

import { ComponentUpdateDetails } from './component-update-details';

import type { ComponentUpdateView } from '../../../application/contracts/publication-views';

const STATUS_VARIANTS = {
  upgradable: 'success',
  needs_review: 'warning',
  unresolvable: 'danger',
} as const;

/** The components with something to update, each opening across all columns to explain it. */
export async function ComponentUpdatesTable({
  components,
  websiteId,
  mayEditPages = false,
}: {
  readonly components: readonly ComponentUpdateView[];
  readonly websiteId?: string;
  readonly mayEditPages?: boolean;
}) {
  const t = await getTranslations('release');
  const columns: ReadonlyArray<ResponsiveColumn<ComponentUpdateView>> = [
    {
      id: 'component',
      label: t('updates.columns.component'),
      cell: (component) => (
        <div className="space-y-1">
          <p className="font-medium [overflow-wrap:anywhere]">{component.type}</p>
          <p className="text-xs text-copy-muted">
            {t('updates.uses', { count: component.usageCount })}
          </p>
        </div>
      ),
    },
    {
      id: 'version',
      label: t('updates.columns.version'),
      cell: ({ fromVersion, toVersion }) => (
        <span className="font-mono text-xs text-copy-muted">
          {toVersion === null
            ? t('updates.noTarget', { from: fromVersion })
            : t('updates.versionChange', { from: fromVersion, to: toVersion })}
        </span>
      ),
    },
    {
      id: 'pages',
      label: t('updates.columns.affects'),
      cell: (component) => t('table.pagesCount', { count: component.pageCount }),
    },
    {
      id: 'status',
      label: t('updates.columns.status'),
      cell: (component) => (
        <Badge variant={STATUS_VARIANTS[component.status]}>
          {t(COMPONENT_UPDATE_MESSAGE_KEYS[component.status])}
        </Badge>
      ),
    },
    {
      id: 'details',
      label: t('updates.details'),
      isAction: true,
      cell: () => (
        <div className="flex justify-end">
          <TableRowDetailsTrigger label={t('updates.details')} />
        </div>
      ),
    },
  ];
  return (
    <ResponsiveTable
      label={t('updates.panelTitle')}
      rows={components}
      rowKey={(component) => component.type}
      rowDetails={(component) => (
        <ComponentUpdateDetails
          component={component}
          t={t}
          websiteId={websiteId}
          mayEditPages={mayEditPages}
        />
      )}
      density="standard"
      columns={columns}
      state={{ kind: 'ready', empty: null }}
    />
  );
}
