import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

import { useTranslations } from '@i18n/client';

import { useBuilderSession } from '../../builder-session-context';

import type { ControlProps } from './control-props';
import type { DatasetOptionDto } from '../../../dto/dataset-options-dto';

/** Radix items cannot carry an empty value, so "no dataset" gets a sentinel no real id can equal. */
const NO_DATASET_VALUE = 'none';
const NO_OPTIONS: readonly DatasetOptionDto[] = [];

/**
 * Picks a dataset for a data-aware component. The options were loaded on
 * the server for this page's own website, so there is nothing to fetch and
 * no client-supplied website to trust. "No dataset" clears the prop and
 * the component falls back to sample data.
 */
export function DatasetControl({ id, field, value, onChange, onCommit }: ControlProps) {
  const t = useTranslations('builder');
  const { datasetOptions } = useBuilderSession();
  const type = field.canonicalKind;

  if (type === null) {
    return (
      <p className="rounded-token-sm border border-dashed border-border p-2 text-xs text-copy-muted">
        {t('properties.dataset.unavailable')}
      </p>
    );
  }

  const options = Object.hasOwn(datasetOptions, type)
    ? (datasetOptions[type] ?? NO_OPTIONS)
    : NO_OPTIONS;

  function handleValueChange(chosen: string): void {
    onChange(chosen === NO_DATASET_VALUE ? undefined : chosen);
    onCommit();
  }

  return (
    <Select
      value={typeof value === 'string' ? value : NO_DATASET_VALUE}
      onValueChange={handleValueChange}
    >
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_DATASET_VALUE}>{t('properties.dataset.placeholder')}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {t('properties.dataset.option', {
              name: option.name,
              source: option.sourceName,
            })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
