'use client';

import { EmptyState } from '@components/layout/layout-primitives';
import { ClampedText } from '@components/shared/page-parts.client';
import { ResponsiveTable } from '@components/shared/responsive-table';
import type { ResponsiveColumn } from '@components/shared/responsive-table';

import { useTranslations } from '@i18n/client';

import { DataSourceMappingSelect } from './data-source-mapping-select';

import type { CanonicalTargetField } from '../../../application/contracts/data-source-constraints';
import type { DiscoveredFieldView } from '../../../application/contracts/dataset-views';

interface DataSourceMappingTableProps {
  readonly fields: readonly DiscoveredFieldView[];
  readonly assignments: Record<string, string>;
  readonly targets: readonly CanonicalTargetField[];
  readonly targetLabel: (path: string) => string;
  readonly targetsUsedElsewhere: (sourcePath: string) => Set<string>;
  readonly onAssign: (sourcePath: string, targetPath: string) => void;
  readonly isPending?: boolean;
}

/** One set of controls survives the table-to-card layout change, preserving focus and edits. */
export function DataSourceMappingTable({
  fields,
  assignments,
  targets,
  targetLabel,
  targetsUsedElsewhere,
  onAssign,
  isPending = false,
}: DataSourceMappingTableProps) {
  const t = useTranslations('dataSources');
  const columns: ReadonlyArray<ResponsiveColumn<DiscoveredFieldView>> = [
    {
      id: 'path',
      label: t('mapping.externalField'),
      cell: (field) => (
        <span className="font-mono text-xs text-copy [overflow-wrap:anywhere]">{field.path}</span>
      ),
    },
    {
      id: 'sample',
      label: t('mapping.sampleValue'),
      cell: (field) => (
        <ClampedText
          text={field.sampleValue}
          showMoreLabel={t('text.showMore')}
          showLessLabel={t('text.showLess')}
          className="text-xs text-copy-muted [overflow-wrap:anywhere]"
        />
      ),
    },
    {
      id: 'target',
      label: t('mapping.targetField'),
      cell: (field) => (
        <DataSourceMappingSelect
          field={field}
          value={assignments[field.path] ?? ''}
          targets={targets}
          usedTargets={targetsUsedElsewhere(field.path)}
          onAssign={onAssign}
          targetLabel={targetLabel}
          isDisabled={isPending}
        />
      ),
    },
  ];
  return (
    <div className="overflow-hidden rounded-token border border-border">
      <ResponsiveTable
        label={t('mapping.tableCaption')}
        rows={fields}
        rowKey={(field) => field.path}
        columns={columns}
        density="compact"
        state={{
          kind: 'ready',
          empty: (
            <EmptyState
              className="py-10"
              title={t('mapping.noFieldsTitle')}
              description={t('mapping.noFields')}
            />
          ),
        }}
      />
    </div>
  );
}
