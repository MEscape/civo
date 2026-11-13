import { describe, expect, it, vi } from 'vitest';

import { writeMigratedPages } from '@modules/release/application/services/write-migrated-pages';
import type { AppliedPage } from '@modules/release/domain/migration/apply-migration';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

describe('writeMigratedPages application service', () => {
  const page1: AppliedPage = {
    path: '/home',
    children: [{ id: 'n1', type: 'hero', props: { title: 'New' }, children: [] }],
    updatedNodeIds: ['n1'],
    skippedNodeIds: [],
  };

  const page2: AppliedPage = {
    path: '/about',
    children: [{ id: 'n2', type: 'text', props: {}, children: [] }],
    updatedNodeIds: ['n2'],
    skippedNodeIds: [],
  };

  const published1 = {
    path: '/home',
    children: [{ id: 'n1', type: 'hero', props: { title: 'Old' }, children: [] }],
  };

  const draft1 = {
    websiteId: 'w1',
    pageId: 'p1',
    version: 1,
    path: '/home',
    children: [{ id: 'n1', type: 'hero', props: { title: 'Old' }, children: [] }],
  };

  it('reports page_missing when page is not present in review drafts or published', async () => {
    const deps = { pages: { replaceChildren: vi.fn() } };
    const review = { published: new Map(), drafts: new Map() };

    const result = await writeMigratedPages(deps as any, review, [page1]);
    expect(result.isOk()).toBe(true);
    const pages = result._unsafeUnwrap();
    expect(pages).toHaveLength(1);
    expect(pages[0]?.outcome).toBe('page_missing');
    expect(pages[0]?.updatedNodeCount).toBe(0);
  });

  it('reports already_applied when draft already contains target children', async () => {
    const deps = { pages: { replaceChildren: vi.fn() } };
    const review = {
      published: new Map([['/home', published1]]),
      drafts: new Map([['/home', { ...draft1, children: page1.children }]]),
    };

    const result = await writeMigratedPages(deps as any, review as any, [page1]);
    expect(result.isOk()).toBe(true);
    const pages = result._unsafeUnwrap();
    expect(pages[0]?.outcome).toBe('already_applied');
    expect(pages[0]?.updatedNodeCount).toBe(1);
  });

  it('reports draft_diverged when draft has diverged from published', async () => {
    const deps = { pages: { replaceChildren: vi.fn() } };
    const review = {
      published: new Map([['/home', published1]]),
      drafts: new Map([['/home', { ...draft1, children: [{ id: 'diverged-node' } as any] }]]),
    };

    const result = await writeMigratedPages(deps as any, review as any, [page1]);
    expect(result.isOk()).toBe(true);
    const pages = result._unsafeUnwrap();
    expect(pages[0]?.outcome).toBe('draft_diverged');
  });

  it('writes page children when writable and marks written outcome', async () => {
    const deps = {
      pages: {
        replaceChildren: vi.fn().mockReturnValue(okAsync(undefined)),
      },
    };
    const review = {
      published: new Map([['/home', published1]]),
      drafts: new Map([['/home', draft1]]),
    };

    const result = await writeMigratedPages(deps as any, review as any, [page1]);
    expect(result.isOk()).toBe(true);
    const pages = result._unsafeUnwrap();
    expect(pages[0]?.outcome).toBe('written');
    expect(pages[0]?.updatedNodeCount).toBe(1);
    expect(deps.pages.replaceChildren).toHaveBeenCalledWith({
      websiteId: 'w1',
      pageId: 'p1',
      expectedVersion: 1,
      children: page1.children,
    });
  });

  it('settles conflict error as draft_diverged and other error as failed', async () => {
    const deps = {
      pages: {
        replaceChildren: vi
          .fn()
          .mockReturnValueOnce(errAsync({ kind: 'conflict', code: 'builder.version_conflict' }))
          .mockReturnValueOnce(errAsync({ kind: 'validation', code: 'builder.invalid' })),
      },
    };
    const review = {
      published: new Map([
        ['/home', published1],
        ['/about', { path: '/about', children: [] }],
      ]),
      drafts: new Map([
        ['/home', draft1],
        ['/about', { websiteId: 'w1', pageId: 'p2', version: 1, path: '/about', children: [] }],
      ]),
    };

    const result = await writeMigratedPages(deps as any, review as any, [page1, page2]);
    expect(result.isOk()).toBe(true);
    const pages = result._unsafeUnwrap();
    expect(pages[0]?.outcome).toBe('draft_diverged');
    expect(pages[1]?.outcome).toBe('failed');
  });

  it('stops operation on unauthorized or forbidden error', async () => {
    const deps = {
      pages: {
        replaceChildren: vi
          .fn()
          .mockReturnValue(errAsync(forbiddenError('builder.forbidden', 'Not allowed.'))),
      },
    };
    const review = {
      published: new Map([['/home', published1]]),
      drafts: new Map([['/home', draft1]]),
    };

    const result = await writeMigratedPages(deps as any, review as any, [page1]);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
  });
});
