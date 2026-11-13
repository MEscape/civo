import { describe, expect, it } from 'vitest';

import { ListMediaUsage } from '@modules/builder/application/queries/list-media-usage';
import { createComponentCatalog } from '@modules/builder/domain/models/component-catalog';
import type { ComponentDescriptor } from '@modules/builder/domain/models/component-descriptor';
import type { PageConfig } from '@modules/builder/domain/models/page-config';

import {
  InMemoryPageRepository,
  OTHER_SITE,
  SITE,
  accessFor,
  actorWithRole,
} from '../support/builder-world';

const components = createComponentCatalog([
  { type: 'hero', fields: [{ key: 'image', control: 'media' }] },
  { type: 'section', fields: [{ key: 'title', control: 'text' }] },
] as unknown as readonly ComponentDescriptor[]);

const showing = (...images: Array<string | undefined>) =>
  ({
    type: 'page',
    children: images.map((image, index) => ({
      id: `n${String(index)}`,
      type: 'hero',
      props: image === undefined ? {} : { image },
      children: [],
    })),
  }) as unknown as PageConfig;

function usageReader() {
  const pages = new InMemoryPageRepository();
  const query = new ListMediaUsage({
    access: accessFor(actorWithRole(SITE, 'editor')),
    pages,
    components,
  });
  return { pages, query };
}

describe('ListMediaUsage', () => {
  it('lists the saved pages and components showing each file, and leaves unused files out', async () => {
    const { pages, query } = usageReader();
    pages.add({ id: 'home', title: 'Home', config: showing('a1', undefined) });
    pages.add({ id: 'town-hall', title: 'Town hall', config: showing('a1', 'a2', 'a1') });
    pages.add({ id: 'empty', title: 'Empty' });

    const usage = (await query.execute(SITE))._unsafeUnwrap();

    expect(usage).toEqual({
      byAsset: {
        a1: [
          { pageId: 'home', title: 'Home', components: [{ nodeId: 'n0', type: 'hero' }] },
          {
            pageId: 'town-hall',
            title: 'Town hall',
            components: [
              { nodeId: 'n0', type: 'hero' },
              { nodeId: 'n2', type: 'hero' },
            ],
          },
        ],
        a2: [
          { pageId: 'town-hall', title: 'Town hall', components: [{ nodeId: 'n1', type: 'hero' }] },
        ],
      },
      isTruncated: false,
    });
  });

  it('answers nothing for another website', async () => {
    const { query } = usageReader();

    const result = await query.execute(OTHER_SITE);

    expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
  });
});
