import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

import { useTranslations } from '@i18n/client';

import type { CanonicalTargetField } from '../../../application/contracts/data-source-constraints';
import type { DiscoveredFieldView } from '../../../application/contracts/dataset-views';

/** Radix items cannot carry an empty value, so "not assigned" gets a sentinel no target path can equal. */
const UNASSIGNED = 'none';

interface DataSourceMappingSelectProps {
  readonly field: DiscoveredFieldView;
  readonly value: string;
  readonly targets: readonly CanonicalTargetField[];
  readonly usedTargets: ReadonlySet<string>;
  readonly onAssign: (sourcePath: string, targetPath: string) => void;
  readonly isDisabled?: boolean;
  readonly targetLabel: (path: string) => string;
}

export function DataSourceMappingSelect({
  field,
  value,
  targets,
  usedTargets,
  onAssign,
  targetLabel,
  isDisabled = false,
}: DataSourceMappingSelectProps) {
  const t = useTranslations('dataSources');

  return (
    <Select
      disabled={isDisabled}
      value={value === '' ? UNASSIGNED : value}
      onValueChange={(chosen) => {
        onAssign(field.path, chosen === UNASSIGNED ? '' : chosen);
      }}
    >
      <SelectTrigger
        aria-label={t('mapping.targetFieldFor', { field: field.path })}
        className="h-8 w-full min-w-0 text-xs"
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
  );
}
