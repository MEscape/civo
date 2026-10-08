import { getPath } from '@lib/utils';

import type {
  PropFieldDescriptor,
  PropItemFieldDescriptor,
  PropOptionDescriptor,
} from '../../application/contracts/builder-constraints';
import type { ComponentCatalog } from '../../application/contracts/editor-model';

/**
 * Display text of platform components. The component platform owns it and
 * publishes only translation keys (its catalog is built once per process
 * and carries no locale), so the builder resolves them per render against
 * the messages the client already has. No React here: the drag controller
 * uses it too.
 *
 * Keys are absolute paths into the message catalog, derived by the platform
 * from the component type and field key, so a runtime lookup is the only
 * way to read them; next-intl's typed `t()` cannot accept them. A missing
 * entry falls back to the technical name (type, field key, option value),
 * which keeps a component whose text is not translated yet usable.
 */
export interface ComponentText {
  componentLabel(type: string): string;
  componentDescription(type: string): string | null;
  fieldLabel(field: PropFieldDescriptor): string;
  fieldPlaceholder(field: PropFieldDescriptor): string | undefined;
  optionLabel(option: PropOptionDescriptor): string;
  itemFieldLabel(itemField: PropItemFieldDescriptor): string;
}

function lookup(messages: unknown, key: string): string | undefined {
  const value = getPath(messages, key);
  return typeof value === 'string' ? value : undefined;
}

export function createComponentText(messages: unknown, catalog: ComponentCatalog): ComponentText {
  return {
    componentLabel: (type) => {
      const descriptor = catalog.describe(type);
      return (descriptor && lookup(messages, descriptor.labelKey)) ?? type;
    },
    componentDescription: (type) => {
      const descriptor = catalog.describe(type);
      return (descriptor && lookup(messages, descriptor.descriptionKey)) ?? null;
    },
    fieldLabel: (field) => lookup(messages, field.labelKey) ?? field.key,
    fieldPlaceholder: (field) =>
      field.placeholderKey === null ? undefined : lookup(messages, field.placeholderKey),
    optionLabel: (option) =>
      (option.labelKey === null ? undefined : lookup(messages, option.labelKey)) ??
      String(option.value),
    itemFieldLabel: (itemField) => lookup(messages, itemField.labelKey) ?? itemField.key,
  };
}
