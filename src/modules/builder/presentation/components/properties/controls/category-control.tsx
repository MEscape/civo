import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

import { useTranslations } from '@i18n/client';

import { categoryChoices } from '../../../properties/category-choices';
import { useBuilderSession } from '../../../state/builder-session-context';

import type { ControlProps } from './control-props';

/** Radix items cannot carry an empty value, so "all categories" gets a sentinel no real category equals. */
const ALL_CATEGORIES_VALUE = '__all__';

function boundDatasetIds(nodeProps: ControlProps['nodeProps']): readonly string[] {
  const primary = nodeProps['datasetId'];
  const further = nodeProps['additionalDatasetIds'];
  return [
    ...(typeof primary === 'string' && primary !== '' ? [primary] : []),
    ...(Array.isArray(further)
      ? further.filter((entry): entry is string => typeof entry === 'string')
      : []),
  ];
}

/**
 * Picks one of the categories the bound datasets contain (or, while nothing
 * is bound, those of the sample data the canvas shows). A stored value the
 * data no longer offers stays selectable so it is visible and can be changed.
 */
export function CategoryControl({ id, field, value, nodeProps, onChange, onCommit }: ControlProps) {
  const t = useTranslations('builder');
  const { categoryOptions } = useBuilderSession();
  const kind = field.canonicalKind;
  const choices =
    kind === null
      ? []
      : categoryChoices(categoryOptions, { kind, datasetIds: boundDatasetIds(nodeProps) });
  const stored = typeof value === 'string' && value !== '' ? value : null;
  const isStale = stored !== null && !choices.includes(stored);

  return (
    <Select
      value={stored ?? ALL_CATEGORIES_VALUE}
      onValueChange={(chosen) => {
        onChange(chosen === ALL_CATEGORIES_VALUE ? undefined : chosen);
        onCommit();
      }}
    >
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_CATEGORIES_VALUE}>{t('properties.category.placeholder')}</SelectItem>
        {isStale && (
          <SelectItem value={stored}>
            {t('properties.category.storedValue', { value: stored })}
          </SelectItem>
        )}
        {choices.map((choice) => (
          <SelectItem key={choice} value={choice}>
            {choice}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
