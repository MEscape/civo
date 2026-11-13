import { describe, expect, it } from 'vitest';

import { createComponentCatalog } from '@modules/builder/domain/models/component-catalog';
import type { ComponentDescriptor } from '@modules/builder/domain/models/component-descriptor';
import type { PageConfig } from '@modules/builder/domain/models/page-config';

import { OTHER_SITE, SITE, actorWithRole, builderWorld } from '../support/builder-world';

const components = createComponentCatalog([
  { type: 'map', fields: [{ key: 'savedMapId', control: 'map' }] },
  { type: 'section', fields: [] },
] as unknown as readonly ComponentDescriptor[]);

const placing = (...mapIds: string[]) =>
  ({
    type: 'page',
    children: mapIds.map((savedMapId, index) => ({
      id: `n${String(index)}`,
      type: 'map',
      props: savedMapId === '' ? {} : { savedMapId },
      children: [],
    })),
  }) as unknown as PageConfig;

describe('ListMapUsage', () => {
  it('lists the components placing each map, page by page, and the map blocks still waiting', async () => {
    const world = builderWorld(actorWithRole(SITE, 'editor'), { components });
    world.pages.add({ id: 'home', title: 'Home', config: placing('m1', '') });
    world.pages.add({ id: 'town-hall', title: 'Town hall', config: placing('m1', 'm2', 'm1') });
    world.pages.add({ id: 'empty', title: 'Empty' });

    const usage = (await world.listMapUsage.execute(SITE))._unsafeUnwrap();

    expect(usage).toEqual({
      byMap: {
        m1: [
          { pageId: 'home', title: 'Home', components: [{ nodeId: 'n0', type: 'map' }] },
          {
            pageId: 'town-hall',
            title: 'Town hall',
            components: [
              { nodeId: 'n0', type: 'map' },
              { nodeId: 'n2', type: 'map' },
            ],
          },
        ],
        m2: [
          { pageId: 'town-hall', title: 'Town hall', components: [{ nodeId: 'n1', type: 'map' }] },
        ],
      },
      awaiting: [{ pageId: 'home', title: 'Home', nodeId: 'n1', type: 'map' }],
      isTruncated: false,
    });
  });

  it('answers nothing for another website', async () => {
    const world = builderWorld(actorWithRole(SITE, 'editor'), { components });

    const result = await world.listMapUsage.execute(OTHER_SITE);

    expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
  });
});
