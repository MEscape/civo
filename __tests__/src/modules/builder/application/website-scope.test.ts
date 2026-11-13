import { describe, expect, it } from 'vitest';

import { BUILDER_RATE_LIMITS } from '@modules/builder/application/rate-limits';
import { BUILDER_ERROR_CODES } from '@modules/builder/domain/errors/builder-errors';

import type { Result } from '@lib/result';

import {
  InMemoryPageRepository,
  OTHER_SITE,
  SITE,
  actorWithRole,
  builderWorld,
  node,
} from '../support/builder-world';

const codeOf = async <T, E extends { code: string }>(result: PromiseLike<Result<T, E>>) =>
  (await result)._unsafeUnwrapErr().code;

const DENIED = 'auth.permission_denied';
const editor = () => builderWorld(actorWithRole(SITE, 'editor'));
const config = (...ids: string[]) => ({ type: 'page', children: ids.map(node) });

/**
 * Pages belong to the website the request names, not to whichever website the session has open:
 * a member of one website who names another gets nothing, whatever the page id.
 */
describe('website scope of the builder', () => {
  it('opens and saves a page of the named website, auditing that website', async () => {
    const world = editor();
    world.pages.add({ id: 'p1' });

    const session = await world.getEditorSession.execute(SITE, 'p1');
    expect(session._unsafeUnwrap().page.id).toBe('p1');

    const saved = await world.savePageConfig.execute({
      websiteId: SITE,
      pageId: 'p1',
      expectedVersion: 1,
      config: config() as never,
    });
    expect(saved._unsafeUnwrap().version).toBe(2);
    expect(world.events).toEqual([
      expect.objectContaining({ type: 'page.config_saved', tenantId: SITE, pageId: 'p1' }),
    ]);
  });

  it('refuses every operation that names a website the person is not a member of', async () => {
    const world = editor();
    world.pages.add({ id: 'p1' });

    expect(await codeOf(world.getEditorSession.execute(OTHER_SITE, 'p1'))).toBe(DENIED);
    expect(
      await codeOf(
        world.savePageConfig.execute({
          websiteId: OTHER_SITE,
          pageId: 'p1',
          expectedVersion: 1,
          config: config() as never,
        }),
      ),
    ).toBe(DENIED);
    expect(
      await codeOf(
        world.renderDraftPage.execute({
          websiteId: OTHER_SITE,
          pageId: 'p1',
          config: config() as never,
        }),
      ),
    ).toBe(DENIED);
    expect(
      await codeOf(world.createPage.execute({ websiteId: OTHER_SITE, path: 'a', title: 'About' })),
    ).toBe(DENIED);
    expect(await codeOf(world.listPages.execute({ websiteId: OTHER_SITE }))).toBe(DENIED);
    expect(await codeOf(world.listDatasetUsage.execute(OTHER_SITE))).toBe(DENIED);
    expect(await codeOf(world.resolvePageTitles.execute(OTHER_SITE, ['p1']))).toBe(DENIED);
    expect(world.pages.saved).toEqual([]);
  });

  it("answers another website's page, named under one's own website, like a page that does not exist", async () => {
    const pages = new InMemoryPageRepository();
    pages.add({ id: 'foreign', tenantId: actorWithRole(OTHER_SITE, 'editor').tenantId });
    const world = builderWorld(actorWithRole(SITE, 'editor'), { pages });

    expect(await codeOf(world.getEditorSession.execute(SITE, 'foreign'))).toBe(
      BUILDER_ERROR_CODES.pageNotFound,
    );
    expect(await codeOf(world.getEditorSession.execute(SITE, 'nothing'))).toBe(
      BUILDER_ERROR_CODES.pageNotFound,
    );
    expect(
      await codeOf(
        world.renderDraftPage.execute({
          websiteId: SITE,
          pageId: 'foreign',
          config: config() as never,
        }),
      ),
    ).toBe(BUILDER_ERROR_CODES.pageNotFound);
    expect(world.rendered).toEqual([]);
  });

  it('renders against the stored website of the page', async () => {
    const world = editor();
    world.pages.add({ id: 'p1' });

    await world.renderDraftPage.execute({
      websiteId: SITE,
      pageId: 'p1',
      config: config() as never,
    });

    expect(world.rendered).toEqual([{ websiteId: SITE }]);
  });

  it('renders the editor preview as visitors will see it, and the canvas as an editing draft', async () => {
    const world = editor();
    world.pages.add({ id: 'p1' });
    const page = { websiteId: SITE, pageId: 'p1', config: config() as never };

    await world.renderDraftPage.execute({ ...page, isPreview: true });
    await world.renderDraftPage.execute(page);

    expect(world.rendered).toEqual([{ websiteId: SITE, isPreview: true }, { websiteId: SITE }]);
  });

  it('keeps the editor away from a viewer, who may read pages but not open the editor', async () => {
    const world = builderWorld(actorWithRole(SITE, 'viewer'));
    world.pages.add({ id: 'p1' });

    expect(await codeOf(world.getEditorSession.execute(SITE, 'p1'))).toBe(DENIED);
  });

  it('lists only the named website, a slice at a time', async () => {
    const world = editor();
    world.pages.add({ id: 'a' });
    world.pages.add({ id: 'b' });
    world.pages.add({ id: 'foreign', tenantId: actorWithRole(OTHER_SITE, 'admin').tenantId });

    const listed = (
      await world.listPages.execute({ websiteId: SITE, pageSize: 1 })
    )._unsafeUnwrap();

    expect(listed.total).toBe(2);
    expect(listed.items).toHaveLength(1);
    expect(listed.pageCount).toBe(2);
  });

  it('creates a page in the named website', async () => {
    const world = editor();

    const created = (
      await world.createPage.execute({ websiteId: SITE, path: 'about', title: 'About us' })
    )._unsafeUnwrap();

    expect(created.title).toBe('About us');
    expect(world.events[0]).toMatchObject({ type: 'page.created', tenantId: SITE });
  });
});

describe('builder rate limits', () => {
  it('refuses a save once the person has used the minute, and writes nothing more', async () => {
    const world = editor();
    world.pages.add({ id: 'p1' });
    const save = () =>
      world.savePageConfig.execute({
        websiteId: SITE,
        pageId: 'p1',
        expectedVersion: 99,
        config: config() as never,
      });
    for (let attempt = 0; attempt < BUILDER_RATE_LIMITS.savePage.limit; attempt += 1) {
      await save();
    }

    expect((await save())._unsafeUnwrapErr()).toMatchObject({
      kind: 'rate_limited',
      code: BUILDER_ERROR_CODES.rateLimited,
    });
    expect(world.pages.saved).toEqual([]);
  });

  it('does not spend a budget for a website the person may not edit', async () => {
    const world = editor();
    world.pages.add({ id: 'p1' });
    for (let attempt = 0; attempt <= BUILDER_RATE_LIMITS.renderDraft.limit + 5; attempt += 1) {
      await world.renderDraftPage.execute({
        websiteId: OTHER_SITE,
        pageId: 'p1',
        config: config() as never,
      });
    }

    const render = await world.renderDraftPage.execute({
      websiteId: SITE,
      pageId: 'p1',
      config: config() as never,
    });
    expect(render.isOk()).toBe(true);
  });
});

describe('dataset usage of a large website', () => {
  it('says when it answered from the first pages only', async () => {
    const world = editor();
    for (let index = 0; index < 520; index += 1) {
      world.pages.add({ id: `p${index}` });
    }

    const usage = (await world.listDatasetUsage.execute(SITE))._unsafeUnwrap();

    expect(usage.isTruncated).toBe(true);
  });

  it('is complete for an ordinary website', async () => {
    const world = editor();
    world.pages.add({ id: 'p1' });

    expect((await world.listDatasetUsage.execute(SITE))._unsafeUnwrap().isTruncated).toBe(false);
  });
});
