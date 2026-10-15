import { describe, expect, it } from 'vitest';

import { createComponentCatalog } from '@modules/builder/domain/models/component-catalog';
import type { ComponentDescriptor } from '@modules/builder/domain/models/component-descriptor';
import type { PageConfig } from '@modules/builder/domain/models/page-config';
import { checkEditScope } from '@modules/builder/domain/rules/page-save-checks';

// What a municipal editor may change is what each component lists as `municipalPropKeys`.
const catalog = createComponentCatalog([
  { type: 'text', municipalPropKeys: ['body'] },
  { type: 'hero', municipalPropKeys: ['title'] },
] as unknown as readonly ComponentDescriptor[]);

const node = (id: string, type: string, props: Record<string, unknown>) => ({
  id: `node-${id}`,
  type,
  props,
  children: [],
});
const page = (...children: Array<ReturnType<typeof node>>) =>
  ({ type: 'page', children }) as unknown as PageConfig;

const STORED = page(node('1', 'text', { body: 'Hello', tone: 'plain' }), node('2', 'hero', {}));

const verdict = (next: PageConfig, canRestructure: boolean) =>
  checkEditScope({ previous: STORED, next, canRestructure, catalog });

describe('checkEditScope', () => {
  describe('for someone who may restructure', () => {
    it('allows any change to structure and props', () => {
      const next = page(
        node('1', 'text', { body: 'Changed', tone: 'loud' }),
        node('3', 'hero', {}),
      );

      expect(verdict(next, true).isOk()).toBe(true);
    });
  });

  describe('for someone who may not', () => {
    it('allows the props a component lists as municipal', () => {
      const next = page(
        node('1', 'text', { body: 'Changed', tone: 'plain' }),
        node('2', 'hero', {}),
      );

      expect(verdict(next, false).isOk()).toBe(true);
    });

    it('allows hiding and showing a component, whatever it is', () => {
      const next = page(
        node('1', 'text', { body: 'Hello', tone: 'plain', visible: false }),
        node('2', 'hero', { visible: false }),
      );

      expect(verdict(next, false).isOk()).toBe(true);
    });

    it('refuses a prop the component does not list', () => {
      const next = page(node('1', 'text', { body: 'Hello', tone: 'loud' }), node('2', 'hero', {}));

      expect(verdict(next, false).isErr()).toBe(true);
    });

    it('refuses an added component', () => {
      const next = page(
        node('1', 'text', { body: 'Hello', tone: 'plain' }),
        node('2', 'hero', {}),
        node('3', 'text', { body: 'New' }),
      );

      expect(verdict(next, false).isErr()).toBe(true);
    });

    it('refuses a removed component', () => {
      const next = page(node('1', 'text', { body: 'Hello', tone: 'plain' }));

      expect(verdict(next, false).isErr()).toBe(true);
    });

    it('refuses a reordered page', () => {
      const next = page(node('2', 'hero', {}), node('1', 'text', { body: 'Hello', tone: 'plain' }));

      expect(verdict(next, false).isErr()).toBe(true);
    });

    it('refuses a prop change on a component type the catalog does not know', () => {
      const unknownStored = page(node('9', 'legacy', { a: 1 }));
      const result = checkEditScope({
        previous: unknownStored,
        next: page(node('9', 'legacy', { a: 2 })),
        canRestructure: false,
        catalog,
      });

      expect(result.isErr()).toBe(true);
    });
  });
});
