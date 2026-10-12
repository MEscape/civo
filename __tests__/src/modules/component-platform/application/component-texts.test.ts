import { describe, expect, it } from 'vitest';

import {
  componentDescriptionKey,
  componentLabelKey,
  fieldLabelKey,
  fieldOptionKey,
  fieldPlaceholderKey,
  itemFieldLabelKey,
} from '@modules/component-platform/application/component-platform-view-mappers';
import { COMPONENT_DEFINITIONS } from '@modules/component-platform/domain/components/component-definitions';
import deComponentPlatform from '@modules/component-platform/presentation/i18n/de.json';
import enComponentPlatform from '@modules/component-platform/presentation/i18n/en.json';

import { getPath } from '@lib/utils';

const CATALOGS = { en: enComponentPlatform, de: deComponentPlatform } as const;

/** Every text key one registered component needs: its names, its fields, their options and placeholders. */
function keysOf(definition: (typeof COMPONENT_DEFINITIONS)[number]): string[] {
  const { type } = definition;
  return [
    componentLabelKey(type),
    componentDescriptionKey(type),
    ...definition.fields.flatMap((field) => [
      fieldLabelKey(type, field.key),
      ...(field.hasPlaceholder ? [fieldPlaceholderKey(type, field.key)] : []),
      ...(field.control === 'select'
        ? field.options.map((value) => fieldOptionKey(type, field.key, value))
        : []),
      ...field.itemFields.map((item) => itemFieldLabelKey(type, field.key, item.key)),
    ]),
  ];
}

describe('the texts of the registered components', () => {
  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`exist in the ${locale} catalog for every component, field, option and placeholder`, () => {
      const missing = COMPONENT_DEFINITIONS.flatMap(keysOf).filter(
        (key) => typeof getPath({ componentPlatform: catalog.componentPlatform }, key) !== 'string',
      );
      expect(missing).toEqual([]);
    });
  }
});
