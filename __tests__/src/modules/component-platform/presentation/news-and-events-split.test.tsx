import { isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { describe, expect, it, vi } from 'vitest';

import { getComponentDefinition } from '@modules/component-platform/application/contracts/component-platform-constraints';
import type { ContentOrigin } from '@modules/component-platform/application/contracts/content-views';
import { getContentDefinition } from '@modules/component-platform/domain/content/content-definitions';
import { NewsAndEventsSplit } from '@modules/component-platform/presentation/components/civic/news-and-events-split/news-and-events-split';
import type { LoadContent } from '@modules/component-platform/presentation/components/page-renderer/load-content';
import { ContentOriginBadge } from '@modules/component-platform/presentation/components/shared/content-origin-badge';

import { infrastructureError } from '@lib/errors';
import { err, ok } from '@lib/result';

vi.mock('@i18n/server', () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
  getAppFormatters: () => Promise.resolve({ date: (value: string) => value }),
}));

const NOW = '2030-06-01T08:00:00.000Z';
const SAMPLE: ContentOrigin = { kind: 'sample', cause: null };
const LIVE: ContentOrigin = { kind: 'live' };

/** Serves the platform's own sample records of whatever kind is asked for, stamped with an origin per kind. */
function loaderWith(origins: {
  readonly news: ContentOrigin;
  readonly events: ContentOrigin;
}): LoadContent {
  return (request) =>
    Promise.resolve(
      ok({
        items: getContentDefinition(request.kind).sample(NOW),
        origin: request.kind === 'NewsItem' ? origins.news : origins.events,
        truncated: false,
      }),
    );
}

function findAll(node: ReactNode, matches: (element: ReactElement) => boolean): ReactElement[] {
  if (Array.isArray(node)) {
    return node.flatMap((child: ReactNode) => findAll(child, matches));
  }
  if (!isValidElement(node)) {
    return [];
  }
  const own = matches(node) ? [node] : [];
  const { children } = node.props as { children?: ReactNode };
  return [...own, ...findAll(children, matches)];
}

function renderSplit(loadContent: LoadContent) {
  return NewsAndEventsSplit({
    props: getComponentDefinition('newsAndEventsSplit').parseProps({}),
    context: { mode: 'draft', websiteId: 'site-1' },
    loadContent,
  });
}

function badges(tree: ReactNode) {
  return findAll(tree, (element) => element.type === ContentOriginBadge);
}

describe('NewsAndEventsSplit', () => {
  it('shows the sample-data note once for the whole block, above the two columns', async () => {
    const tree = await renderSplit(loaderWith({ news: SAMPLE, events: SAMPLE }));

    const found = badges(tree);
    expect(found).toHaveLength(1);
    expect(found[0]?.props).toMatchObject({ origin: SAMPLE, placement: 'inline' });
  });

  it('shows the note when only one column uses sample data', async () => {
    const tree = await renderSplit(loaderWith({ news: LIVE, events: SAMPLE }));

    expect(badges(tree)).toHaveLength(1);
  });

  it('shows no note while both columns carry real data', async () => {
    const tree = await renderSplit(loaderWith({ news: LIVE, events: LIVE }));

    expect(badges(tree)).toHaveLength(0);
  });

  it('lays the columns out by the width of the block, not of the window', async () => {
    const tree = await renderSplit(loaderWith({ news: LIVE, events: LIVE }));

    const classes = findAll(tree, (element) => typeof element.type === 'string').map(
      (element) => (element.props as { className?: string }).className ?? '',
    );
    expect(classes.some((value) => value.includes('@container'))).toBe(true);
    expect(classes.some((value) => /grid-cols-1.*@3xl:grid-cols-2/.test(value))).toBe(true);
    expect(classes.some((value) => /\blg:grid-cols-2\b/.test(value))).toBe(false);
  });

  it('degrades one failing column without taking the other down', async () => {
    const failing: LoadContent = (request) =>
      request.kind === 'NewsItem'
        ? Promise.resolve(err(infrastructureError('test.failed', 'failed')))
        : loaderWith({ news: LIVE, events: LIVE })(request);

    const tree = await renderSplit(failing);

    const columns = findAll(tree, (element) => 'list' in (element.props as object));
    expect(columns.map((column) => (column.props as { list: unknown }).list === null)).toEqual([
      true,
      false,
    ]);
  });
});
