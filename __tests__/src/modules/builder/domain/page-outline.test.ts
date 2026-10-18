import { describe, expect, it } from 'vitest';

import { createComponentCatalog } from '@modules/builder/domain/models/component-catalog';
import type { ComponentDescriptor } from '@modules/builder/domain/models/component-descriptor';
import type { PageConfig } from '@modules/builder/domain/models/page-config';
import { MAX_OUTLINE_BLOCKS, outlineOf } from '@modules/builder/domain/models/page-outline';

const catalog = createComponentCatalog([
  { type: 'columns', category: 'layout' },
  { type: 'text', category: 'content' },
  { type: 'map', category: 'smartcity' },
] as unknown as readonly ComponentDescriptor[]);

interface TestNode {
  readonly id: string;
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children: readonly TestNode[];
}

let next = 0;
const node = (type: string, children: readonly TestNode[] = []): TestNode => ({
  id: `node-${(next += 1)}`,
  type,
  props: {},
  children,
});
const page = (...children: TestNode[]) => ({ type: 'page', children }) as unknown as PageConfig;

describe('outlineOf', () => {
  it('sketches text as lines, layouts by their columns and anything else as a widget', () => {
    const outline = outlineOf(
      page(node('text'), node('columns', [node('text'), node('map')]), node('map')),
      catalog,
    );

    expect(outline).toEqual([
      { shape: 'text', columns: 1 },
      { shape: 'layout', columns: 2 },
      { shape: 'widget', columns: 1 },
    ]);
  });

  it('keeps a few blocks and a few columns, however large the page', () => {
    const wide = node('columns', Array.from({ length: 9 }, () => node('text')));
    const outline = outlineOf(page(...Array.from({ length: 9 }, () => wide)), catalog);

    expect(outline).toHaveLength(MAX_OUTLINE_BLOCKS);
    expect(outline[0]).toEqual({ shape: 'layout', columns: 4 });
  });

  it('sketches a component the catalog no longer knows as a widget, and an empty layout as one column', () => {
    expect(outlineOf(page(node('removed'), node('columns')), catalog)).toEqual([
      { shape: 'widget', columns: 1 },
      { shape: 'layout', columns: 1 },
    ]);
  });
});
