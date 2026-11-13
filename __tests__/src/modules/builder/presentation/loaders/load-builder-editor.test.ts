import { describe, expect, it, vi } from 'vitest';

import { loadBuilderEditor } from '@modules/builder/presentation/loaders/load-builder-editor';
import type { BuilderEditorReaders } from '@modules/builder/presentation/loaders/load-builder-editor';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not-found');
  },
}));

const session = {
  page: {
    id: 'p1',
    websiteId: 'site-1',
    path: 'about',
    title: 'About',
    version: 2,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-02-01T00:00:00Z'),
    config: { type: 'page', children: [] },
  },
  canRestructure: true,
  components: [],
};

function readers(overrides: Partial<BuilderEditorReaders> = {}): BuilderEditorReaders {
  return {
    getEditorSession: { execute: () => okAsync(session as never) },
    listCompatibleDatasets: {
      execute: () =>
        okAsync({
          items: [
            { id: 'd1', name: 'Events', canonicalKind: 'events', source: { name: 'Calendar' } },
            { id: 'd2', name: 'Waste', canonicalKind: 'waste', source: { name: 'Council' } },
          ],
          isTruncated: false,
        }),
    },
    listContentCategories: {
      execute: () => okAsync({ byDataset: {}, sampleByKind: {} }),
    },
    getBookingChoices: {
      execute: () => okAsync({ services: [], categories: ['Passports'] }),
    },
    ...overrides,
  };
}

const input = { websiteId: 'site-1', pageId: 'p1', searchParams: {} };

describe('loadBuilderEditor', () => {
  it('gathers the session and the choices of other modules for the editor', async () => {
    const view = await loadBuilderEditor({
      ...input,
      searchParams: { select: ['n1', 'n2'] },
      readers: readers(),
    });

    expect(view.page).toEqual({ title: 'About', path: 'about' });
    expect(view.session.page.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(view.datasetOptions).toEqual({
      events: [{ id: 'd1', name: 'Events', sourceName: 'Calendar' }],
      waste: [{ id: 'd2', name: 'Waste', sourceName: 'Council' }],
    });
    expect(view.bookingChoices.categories).toEqual(['Passports']);
    expect(view.initialSelection).toBeUndefined();
  });

  it('opens with the component the address selects', async () => {
    const view = await loadBuilderEditor({
      ...input,
      searchParams: { select: 'n1' },
      readers: readers(),
    });
    expect(view.initialSelection).toBe('n1');
  });

  it('offers "all" when the booking module cannot answer, and still opens', async () => {
    const view = await loadBuilderEditor({
      ...input,
      readers: readers({
        getBookingChoices: { execute: () => errAsync(forbiddenError('x', 'no')) },
      }),
    });
    expect(view.bookingChoices).toEqual({ services: [], categories: [] });
  });

  it('shows "not found" for a page the person may not edit, and reads nothing else', async () => {
    const listCompatibleDatasets = {
      execute: vi.fn(() => okAsync({ items: [], isTruncated: false })),
    };

    await expect(
      loadBuilderEditor({
        ...input,
        readers: readers({
          getEditorSession: { execute: () => errAsync(forbiddenError('x', 'no')) },
          listCompatibleDatasets,
        }),
      }),
    ).rejects.toThrow('not-found');
    expect(listCompatibleDatasets.execute).not.toHaveBeenCalled();
  });
});
