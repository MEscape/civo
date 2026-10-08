import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

import { useTranslations } from '@i18n/client';

import type { CanonicalTargetField } from '../../application/contracts/data-source-constraints';
import type { DiscoveredFieldView } from '../../application/contracts/data-source-views';

/** Radix items cannot carry an empty value, so "not assigned" gets a sentinel no target path can equal. */
const UNASSIGNED = 'none';

export interface DataSourceMappingRowProps {
  readonly field: DiscoveredFieldView;
  readonly value: string;
  readonly targets: readonly CanonicalTargetField[];
  readonly usedTargets: ReadonlySet<string>;
  readonly onAssign: (sourcePath: string, targetPath: string) => void;
  readonly targetLabel: (path: string) => string;
}

export function DataSourceMappingRow({
  field,
  value,
  targets,
  usedTargets,
  onAssign,
  targetLabel,
}: DataSourceMappingRowProps) {
  const t = useTranslations('dataSources');

  return (
    <tr className="border-b border-border last:border-0">
      <th scope="row" className="py-1.5 pr-3 text-left font-mono text-xs font-normal text-copy">
        {field.path}
      </th>
      <td className="max-w-40 truncate py-1.5 pr-3 text-copy-muted">{field.sampleValue}</td>
      <td className="py-1.5">
        <Select
          value={value === '' ? UNASSIGNED : value}
          onValueChange={(chosen) => {
            onAssign(field.path, chosen === UNASSIGNED ? '' : chosen);
          }}
        >
          <SelectTrigger
            aria-label={t('mapping.targetFieldFor', { field: field.path })}
            className="h-8 max-w-56 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>{t('mapping.unassigned')}</SelectItem>
            {targets.map((target) => {
              const isTaken = usedTargets.has(target.path);
              return (
                <SelectItem key={target.path} value={target.path} disabled={isTaken}>
                  {t('mapping.targetOption', {
                    label: targetLabel(target.path),
                    required: target.required ? 'yes' : 'no',
                    taken: isTaken ? 'yes' : 'no',
                  })}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </td>
    </tr>
  );
}
