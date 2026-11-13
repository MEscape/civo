import { useBuilderSession } from '../state/builder-session-context';

import type { ControlProps } from '../components/properties/controls/control-props';
import type { DatasetOptionDto } from '../dto/dataset-options-dto';

const NO_OPTIONS: readonly DatasetOptionDto[] = [];

function selectedIds(value: ControlProps['value']): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

type DatasetsControlInput = Omit<ControlProps, 'id' | 'labelId'>;

/**
 * What the datasets control offers and chooses: the options of the
 * component's kind except its primary dataset, the ticked ones, and the
 * toggle that keeps an empty selection as an unset prop.
 */
export function useDatasetsControl({
  field,
  value,
  nodeProps,
  onChange,
  onCommit,
}: DatasetsControlInput) {
  const { datasetOptions } = useBuilderSession();
  const kind = field.canonicalKind;
  const selected = selectedIds(value);
  const max = field.bounds?.max ?? selected.length;
  const options =
    kind === null
      ? NO_OPTIONS
      : ((Object.hasOwn(datasetOptions, kind) ? datasetOptions[kind] : undefined) ?? NO_OPTIONS);

  function toggle(datasetId: string, isChecked: boolean): void {
    const next = isChecked
      ? [...selected, datasetId]
      : selected.filter((existing) => existing !== datasetId);
    onChange(next.length === 0 ? undefined : next);
    onCommit();
  }

  return {
    kind,
    selected,
    max,
    isFull: selected.length >= max,
    choices: options.filter((option) => option.id !== nodeProps['datasetId']),
    toggle,
  };
}
