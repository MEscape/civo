import type { ReactNode } from 'react';

import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ReleasePreview } from '@modules/release/presentation/components/preview/release-preview';
import type { ReleasePreviewProps } from '@modules/release/presentation/components/preview/release-preview';

import { okAsync } from '@lib/result';

import { resolveServerComponents } from '../../../../../support/server-components';
import { LIVE_RELEASE, previewViewOf } from '../../../support/release-fixtures';
import { renderInReleaseIntl } from '../../../support/release-intl';

const { readers } = vi.hoisted(() => ({
  readers: {
    getReleasePreview: { execute: vi.fn() },
    resolveMemberNames: vi.fn(),
    listReleases: { execute: vi.fn() },
    listMigrations: { execute: vi.fn() },
    getPublicationStatus: { execute: vi.fn() },
  },
}));

vi.mock('@modules/release/composition', () => ({ getReleaseScreenQueries: () => readers }));
vi.mock('@modules/release/presentation/actions/rollback-release-action', () => ({
  rollbackReleaseAction: vi.fn(),
}));
vi.mock('@components/providers/i18n-provider', () => ({
  I18nProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@i18n/server', () => ({
  getTranslations: async () => (await import('../../../support/release-intl')).releaseTranslator(),
  getAppFormatters: async () => ({ dateTime: (value: Date) => value.toISOString() }),
}));
vi.mock('@i18n/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAppFormatters: () => ({ dateTime: (value: string) => value }),
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const props: ReleasePreviewProps = {
  locale: 'en',
  websiteId: 'w1',
  releaseId: 'r2',
  searchParams: { from: '2', fromPageSize: '25' },
  mayRollback: false,
  renderPage: (page) => <p>frozen {page.title}</p>,
};

async function renderPreview(overrides: Partial<ReleasePreviewProps> = {}, view = previewViewOf()) {
  readers.getReleasePreview.execute.mockReturnValue(okAsync(view));
  readers.resolveMemberNames.mockReturnValue(
    okAsync({ names: [{ id: 'actor-anna', name: 'Anna Müller' }] }),
  );
  renderInReleaseIntl(
    await resolveServerComponents(await ReleasePreview({ ...props, ...overrides })),
  );
}

describe('ReleasePreview', () => {
  it('leads back to the page of the release list the person came from', async () => {
    await renderPreview();

    const breadcrumb = screen.getByRole('navigation', { name: 'Release navigation' });
    expect(within(breadcrumb).getByRole('link', { name: 'Releases' })).toHaveAttribute(
      'href',
      '/websites/w1/releases?page=2&pageSize=25',
    );
  });

  it('names the release, marks it live, and says when and by whom it was published', async () => {
    await renderPreview();

    expect(screen.getByRole('heading', { level: 1, name: 'Preview of release #2' })).toBeVisible();
    expect(screen.getByText('Live now')).toBeInTheDocument();
    expect(screen.getByText('Contact page reworked')).toBeInTheDocument();
    expect(screen.getByText(/Published by Anna Müller/)).toBeInTheDocument();
  });

  it('links the release before it and leaves the end of the history disabled', async () => {
    await renderPreview();

    expect(screen.getByRole('link', { name: 'Older release #1' })).toHaveAttribute(
      'href',
      '/websites/w1/releases/r1/preview?from=2&fromPageSize=25',
    );
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();
  });

  it('offers to restore an earlier release only to someone who may', async () => {
    const earlier = { ...LIVE_RELEASE, id: 'r1', isActive: false, canRollback: true };
    await renderPreview({ mayRollback: true }, previewViewOf({ release: earlier }));
    expect(screen.getByRole('button', { name: /Restore release #2/ })).toBeInTheDocument();
  });

  it('shows no restore control to someone who may not', async () => {
    const earlier = { ...LIVE_RELEASE, id: 'r1', isActive: false, canRollback: true };
    await renderPreview({ mayRollback: false }, previewViewOf({ release: earlier }));
    expect(screen.queryByRole('button', { name: /Restore/ })).toBeNull();
  });

  it('lists the pages of the release as tabs and draws the one asked for', async () => {
    await renderPreview({ searchParams: { path: 'about' } });

    const tabs = screen.getByRole('navigation', { name: 'Pages of this release' });
    const links = within(tabs).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Home page', 'About us']);
    expect(within(tabs).getByRole('link', { name: 'About us' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText('frozen About us')).toBeInTheDocument();
  });

  it('says so, instead of failing, when the stored page cannot be read', async () => {
    await renderPreview({ renderPage: () => null });

    expect(screen.getByText('This page cannot be shown')).toBeInTheDocument();
  });

  it('says nothing about fidelity for a release today can draw exactly', async () => {
    await renderPreview();

    expect(screen.queryByText('This release can look different today')).toBeNull();
  });

  it('warns when components moved on or are gone, naming each one', async () => {
    await renderPreview(
      {},
      previewViewOf({
        fidelity: {
          status: 'unavailable',
          deviations: [
            { type: 'oldWidget', pinnedVersion: 1, currentVersion: null },
            { type: 'hero', pinnedVersion: 1, currentVersion: 2 },
          ],
        },
      }),
    );

    expect(screen.getByText('This release cannot be shown as it was')).toBeInTheDocument();
    expect(screen.getByText('oldWidget (v1, no longer available)')).toBeInTheDocument();
    expect(screen.getByText('hero (v1 → v2)')).toBeInTheDocument();
  });
});
