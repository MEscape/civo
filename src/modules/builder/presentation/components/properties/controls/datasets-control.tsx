import { CheckboxField } from '@components/shared/field';

import { useTranslations } from '@i18n/client';

import { useDatasetsControl } from '../../../hooks/use-datasets-control';

import type { ControlProps } from './control-props';

/**
 * Further datasets of the component's kind, read together with its primary
 * dataset (one per district or waste type, for example). The options were
 * loaded on the server for this page's own website, like the primary
 * dataset's. An empty selection clears the prop.
 */
export function DatasetsControl({ id, labelId, ...control }: ControlProps) {
  const t = useTranslations('builder');
  const { kind, choices, selected, max, isFull, toggle } = useDatasetsControl(control);

  if (kind === null) {
    return (
      <p className="rounded-token-sm border border-dashed border-border p-2 text-xs text-copy-muted">
        {t('properties.dataset.unavailable')}
      </p>
    );
  }
  if (choices.length === 0) {
    return <p className="text-xs text-copy-muted">{t('properties.datasets.empty')}</p>;
  }

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
              toggle(option.id, event.target.checked);
            }}
          />
        );
      })}
      <p className="text-xs text-copy-muted">{t('properties.datasets.limit', { max })}</p>
    </div>
  );
}
