import { describe, expect, it } from 'vitest';

import { createComponentCatalog } from '@modules/builder/domain/models/component-catalog';
import type { ComponentDescriptor } from '@modules/builder/domain/models/component-descriptor';
import type { PageConfig } from '@modules/builder/domain/models/page-config';
import { checkComposition } from '@modules/builder/domain/rules/page-save-checks';
import { insertNewComponent } from '@modules/builder/domain/tree/tree-operations';

import { findBookingPagePath } from '@/app/_lib/booking-page';

const descriptor = (type: string, isSingleton: boolean) =>
  ({
    type,
    isSingleton,
    isAllowedAtRoot: true,
    acceptsChildren: type === 'section',
    allowedChildTypes: ['booking', 'text'],
    municipalPropKeys: [],
    blueprint: { type, props: {}, children: [] },
  }) as unknown as ComponentDescriptor;

const catalog = createComponentCatalog([
  descriptor('booking', true),
  descriptor('text', false),
  descriptor('section', false),
]);

const node = (id: string, type: string, children: unknown[] = []) => ({
  id: `node-${id}`,
  type,
  props: {},
  children,
});
const config = (...children: unknown[]) => ({ type: 'page', children }) as unknown as PageConfig;

describe('a component that fits once on a page', () => {
  it('is saved once, and not a second time wherever it sits', () => {
    expect(checkComposition(config(node('1', 'booking'), node('2', 'text')), catalog).isOk()).toBe(
      true,
    );

    const twice = checkComposition(
      config(node('1', 'booking'), node('2', 'section', [node('3', 'booking')])),
      catalog,
    );

    expect(twice.isErr()).toBe(true);
    expect(JSON.stringify(twice._unsafeUnwrapErr())).toContain('singleton_exceeded');
  });

  it('is not added a second time, by click or by drag, but a component that may repeat is', () => {
    const nodes = config(node('1', 'booking'), node('2', 'text')).children;
    const placement = { parentId: null, index: 2 };

    const second = insertNewComponent({
      nodes,
      catalog,
      componentType: 'booking',
      placement,
      idSeed: 'seed',
    });
    const another = insertNewComponent({
      nodes,
      catalog,
      componentType: 'text',
      placement,
      idSeed: 'seed',
    });

    expect(second.isErr()).toBe(true);
    expect(another.isOk()).toBe(true);
  });
});

describe('finding the page that holds the booking, for the links in e-mails', () => {
  const stored = (path: string, ...children: unknown[]) => ({ path, config: config(...children) });

  it('stays on the page asked for when it holds the booking', () => {
    const pages = [stored('', node('1', 'text')), stored('termine', node('2', 'booking'))];

    expect(findBookingPagePath(pages, 'termine')).toBe('termine');
  });

  it('prefers the home page, then the first page, and says nothing when there is none', () => {
    const withBooking = (path: string) =>
      stored(path, node(path || 'home', 'section', [node('booking-node', 'booking')]));

    expect(findBookingPagePath([withBooking('a'), withBooking(''), withBooking('b')], 'x')).toBe(
      '',
    );
    expect(findBookingPagePath([stored('c'), withBooking('b'), withBooking('a')], 'x')).toBe('b');
    expect(findBookingPagePath([stored('c', node('1', 'text'))], 'x')).toBeNull();
  });
});
