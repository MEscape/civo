import { CheckboxField } from '@components/shared/checkbox-field';

import { useTranslations } from '@i18n/client';

import { useBuilderSession } from '../../../state/builder-session-context';

import type { ControlProps } from './control-props';
import type { DatasetOptionDto } from '../../../dto/dataset-options-dto';

const NO_OPTIONS: readonly DatasetOptionDto[] = [];

function selectedIds(value: ControlProps['value']): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

/**
 * Further datasets of the component's kind, read together with its primary
 * dataset (one per district or waste type, for example). The options were
 * loaded on the server for this page's own website, like the primary
 * dataset's. An empty selection clears the prop.
 */
export function DatasetsControl({
  id,
  labelId,
  field,
  value,
  nodeProps,
  onChange,
  onCommit,
}: ControlProps) {
  const t = useTranslations('builder');
  const { datasetOptions } = useBuilderSession();
  const kind = field.canonicalKind;
  const selected = selectedIds(value);
  const primaryId = nodeProps['datasetId'];
  const max = field.bounds?.max ?? selected.length;

  if (kind === null) {
    return (
      <p className="rounded-token-sm border border-dashed border-border p-2 text-xs text-copy-muted">
        {t('properties.dataset.unavailable')}
      </p>
    );
  }

  const options =
    (Object.hasOwn(datasetOptions, kind) ? datasetOptions[kind] : undefined) ?? NO_OPTIONS;
  const choices = options.filter((option) => option.id !== primaryId);
  if (choices.length === 0) {
    return <p className="text-xs text-copy-muted">{t('properties.datasets.empty')}</p>;
  }

  function handleToggle(datasetId: string, isChecked: boolean): void {
    const next = isChecked
      ? [...selected, datasetId]
      : selected.filter((existing) => existing !== datasetId);
    onChange(next.length === 0 ? undefined : next);
    onCommit();
  }

  const isFull = selected.length >= max;

  return (
    <div id={id} role="group" aria-labelledby={labelId} className="space-y-2">
      {choices.map((option) => {
        const isChecked = selected.includes(option.id);
        return (
          <CheckboxField
            key={option.id}
            id={`${id}-${option.id}`}
            label={t('properties.dataset.option', { name: option.name, source: option.sourceName })}
            checked={isChecked}
            disabled={!isChecked && isFull}
            onChange={(event) => {
              handleToggle(option.id, event.target.checked);
            }}
          />
        );
      })}
      <p className="text-xs text-copy-muted">{t('properties.datasets.limit', { max })}</p>
    </div>
  );
}
