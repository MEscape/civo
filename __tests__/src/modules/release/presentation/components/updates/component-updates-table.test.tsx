import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import type { ComponentUpdateView } from '@modules/release/application/contracts/publication-views';
import { ComponentUpdatesTable } from '@modules/release/presentation/components/updates/component-updates-table';
import enRelease from '@modules/release/presentation/i18n/en.json';

vi.mock('@i18n/server', () => ({
  getTranslations: async () => (await import('../../../support/release-intl')).releaseTranslator(),
}));

const HERO: ComponentUpdateView = {
  type: 'hero',
  fromVersion: 1,
  toVersion: 2,
  usageCount: 1,
  pageCount: 1,
  pagePaths: [''],
  status: 'needs_review',
  addedFields: ['phoneNumber'],
  conflictFields: ['title'],
};
const GRID: ComponentUpdateView = {
  type: 'serviceGrid',
  fromVersion: 3,
  toVersion: 4,
  usageCount: 2,
  pageCount: 2,
  pagePaths: ['', 'services'],
  status: 'upgradable',
  addedFields: [],
  conflictFields: [],
};

async function renderTable(components: readonly ComponentUpdateView[], mayEditPages = false) {
  render(
    <NextIntlClientProvider locale="en" messages={enRelease} timeZone="UTC">
      {await ComponentUpdatesTable({ components, websiteId: 'site-1', mayEditPages })}
    </NextIntlClientProvider>,
  );
}

describe('ComponentUpdatesTable', () => {
  it('names the components, their versions and how ready each is, without a click', async () => {
    await renderTable([HERO, GRID]);

    const hero = screen.getByText('hero').closest('tr');
    expect(hero).toHaveTextContent('v1 → v2');
    expect(hero).toHaveTextContent('Needs review');
    const grid = screen.getByText('serviceGrid').closest('tr');
    expect(grid).toHaveTextContent('2 pages');
    expect(grid).toHaveTextContent('Compatible');
  });

  it('opens a component to say where it is used and what changes for it', async () => {
    await renderTable([HERO]);

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByRole('region', { name: 'Details' }).closest('td')).toHaveAttribute(
      'colspan',
      '5',
    );

    expect(screen.getByText('On these pages')).toBeInTheDocument();
    expect(screen.getByText('phoneNumber')).toBeInTheDocument();
    expect(screen.getByText('title')).toBeInTheDocument();
  });

  it('says a component without a newer version to move to cannot be updated', async () => {
    await renderTable([
      { ...HERO, toVersion: null, status: 'unresolvable', addedFields: [], conflictFields: [] },
    ]);

    expect(screen.getByText('v1 → none')).toBeInTheDocument();
    expect(screen.getByText('Cannot be updated')).toBeInTheDocument();
  });

  it('links authorized editors directly to the current draft component and preserves the expanded row', async () => {
    await renderTable(
      [{ ...HERO, editorTargets: [{ pageId: 'p1', nodeId: 'hero / one', path: '' }] }],
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByRole('link', { name: /Open component in editor/ })).toHaveAttribute(
      'href',
      '/en/websites/site-1/builder/p1?select=hero%20%2F%20one',
    );
  });

  it('keeps editor links out of a read-only view', async () => {
    await renderTable([{ ...HERO, editorTargets: [{ pageId: 'p1', nodeId: 'n1', path: '' }] }]);
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(
      screen.queryByRole('link', { name: /Open component in editor/ }),
    ).not.toBeInTheDocument();
  });
});
