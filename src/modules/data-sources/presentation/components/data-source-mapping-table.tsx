'use client';

import { useTranslations } from '@i18n/client';

import { DataSourceMappingRow } from './data-source-mapping-row';

import type { CanonicalTargetField } from '../../application/contracts/data-source-constraints';
import type { DiscoveredFieldView } from '../../application/contracts/data-source-views';

export interface DataSourceMappingTableProps {
  readonly fields: readonly DiscoveredFieldView[];
  readonly assignments: Record<string, string>;
  readonly targets: readonly CanonicalTargetField[];
  readonly targetLabel: (path: string) => string;
  readonly targetsUsedElsewhere: (sourcePath: string) => Set<string>;
  readonly onAssign: (sourcePath: string, targetPath: string) => void;
}

export function DataSourceMappingTable({
  fields,
  assignments,
  targets,
  targetLabel,
  targetsUsedElsewhere,
  onAssign,
}: DataSourceMappingTableProps) {
  const t = useTranslations('dataSources');

  if (fields.length === 0) {
    return <p className="text-sm text-copy-muted">{t('mapping.noFields')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{t('mapping.tableCaption')}</caption>
        <thead>
          <tr className="border-b border-border text-left text-copy-muted">
            <th scope="col" className="py-1.5 pr-3 font-medium">
              {t('mapping.externalField')}
            </th>
            <th scope="col" className="py-1.5 pr-3 font-medium">
              {t('mapping.sampleValue')}
            </th>
            <th scope="col" className="py-1.5 font-medium">
              {t('mapping.targetField')}
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <DataSourceMappingRow
              key={field.path}
              field={field}
              value={assignments[field.path] ?? ''}
              targets={targets}
              usedTargets={targetsUsedElsewhere(field.path)}
              onAssign={onAssign}
              targetLabel={targetLabel}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
