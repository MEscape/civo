import { describe, expect, it } from 'vitest';

import { componentEditorTargets } from '@modules/release/application/services/component-editor-targets';
import type { PageTree } from '@modules/release/domain/migration/page-tree';
import type { PublishablePage } from '@modules/release/domain/publishing/publishable';

const pages: readonly PublishablePage[] = [
  {
    status: 'ready',
    pageId: 'p1',
    path: '',
    title: 'Home',
    componentTypes: ['hero'],
    config: { type: 'page', children: [] },
  },
];
const trees: readonly PageTree[] = [
  {
    path: '',
    children: [
      {
        id: 'section',
        type: 'section',
        props: {},
        children: [{ id: 'hero-current', type: 'hero', props: {}, children: [] }],
      },
    ],
  },
];

describe('component editor targets', () => {
  it('resolves nested current instances to their page and node, including the home page', () => {
    expect(componentEditorTargets('hero', pages, trees)).toEqual([
      { pageId: 'p1', nodeId: 'hero-current', path: '' },
    ]);
  });
  it('offers no guessed link for removed components, deleted pages or sources without an editor id', () => {
    expect(componentEditorTargets('removed', pages, trees)).toEqual([]);
    expect(componentEditorTargets('hero', [], trees)).toEqual([]);
    expect(
      componentEditorTargets(
        'hero',
        [{ status: 'config_missing', path: '', title: 'Home' }],
        trees,
      ),
    ).toEqual([]);
  });
});
