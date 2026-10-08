import { CONTENT_DEFINITIONS } from '../domain/content/content-definitions';

import type {
  CatalogFieldView,
  ComponentCatalogEntry,
  ComponentReleaseInfo,
} from './contracts/catalog-views';
import type {
  ComponentDefinition,
  PropFieldDefinition,
} from '../domain/models/component-definition';

/**
 * Where a component's user-facing text lives in the translation catalog.
 * Keys are derived from the component type and field key, never written
 * twice: a test checks that every registered component has all of them in
 * every locale. The namespace is `componentPlatform` in `presentation/i18n`.
 */
const TEXT_ROOT = 'componentPlatform.components';

export function componentLabelKey(type: string): string {
  return `${TEXT_ROOT}.${type}.label`;
}

export function componentDescriptionKey(type: string): string {
  return `${TEXT_ROOT}.${type}.description`;
}

export function fieldLabelKey(type: string, field: string): string {
  return `${TEXT_ROOT}.${type}.fields.${field}.label`;
}

export function fieldPlaceholderKey(type: string, field: string): string {
  return `${TEXT_ROOT}.${type}.fields.${field}.placeholder`;
}

export function itemFieldLabelKey(type: string, field: string, itemField: string): string {
  return `${TEXT_ROOT}.${type}.fields.${field}.fields.${itemField}.label`;
}

export function fieldOptionKey(type: string, field: string, value: string | number): string {
  return `${TEXT_ROOT}.${type}.fields.${field}.options.${String(value)}`;
}

function toFieldView(
  definition: ComponentDefinition,
  field: PropFieldDefinition,
): CatalogFieldView {
  return {
    key: field.key,
    control: field.control,
    group: field.group,
    labelKey: fieldLabelKey(definition.type, field.key),
    placeholderKey: field.hasPlaceholder ? fieldPlaceholderKey(definition.type, field.key) : null,
    options: field.options.map((value) => ({
      value,
      labelKey:
        field.control === 'select' ? fieldOptionKey(definition.type, field.key, value) : null,
    })),
    bounds: field.bounds,
    canonicalKind:
      field.control === 'dataset'
        ? (field.datasetKind ?? definition.dataBinding?.canonicalKind ?? null)
        : null,
    itemFields: field.itemFields.map((itemField) => ({
      key: itemField.key,
      labelKey: itemFieldLabelKey(definition.type, field.key, itemField.key),
      multiline: itemField.multiline,
    })),
  };
}

export function toCatalogEntry(definition: ComponentDefinition): ComponentCatalogEntry {
  return {
    type: definition.type,
    version: definition.version,
    category: definition.category,
    labelKey: componentLabelKey(definition.type),
    descriptionKey: componentDescriptionKey(definition.type),
    canHaveChildren: definition.canHaveChildren,
    acceptsChildTypes: definition.acceptsChildTypes,
    fields: definition.fields.map((field) => toFieldView(definition, field)),
    municipalFields: definition.municipalFields,
    municipallyEditable: definition.municipallyEditable,
    dependsOnContracts: definition.dependsOnContracts,
    blueprint: { type: definition.type, props: definition.defaultProps },
  };
}

export function toReleaseInfo(definition: ComponentDefinition): ComponentReleaseInfo {
  return {
    version: definition.version,
    dependsOnContracts: definition.dependsOnContracts.map((dependency) => ({
      ...dependency,
      currentVersion: CONTENT_DEFINITIONS[dependency.contract].version,
    })),
  };
}
