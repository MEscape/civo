import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { MigrationReview } from '@modules/release/presentation/components/migration-review';
import enRelease from '@modules/release/presentation/i18n/en.json';

vi.mock('@modules/release/presentation/actions/apply-migration-action', () => ({
  applyMigrationAction: vi.fn(),
}));

const node = (id: string, status: 'upgradable' | 'needs_review') =>
  status === 'upgradable'
    ? { nodeId: id, type: 'hero', status, fromVersion: 1, toVersion: 2, addedFields: [] }
    : {
        nodeId: id,
        type: 'hero',
        status,
        fromVersion: 1,
        toVersion: 2,
        addedFields: [],
        conflicts: [],
      };

/** `count` pages with one component each; the last one needs a decision. */
function planOf(count: number) {
  const pages = Array.from({ length: count }, (_, index) => ({
    path: `page-${index + 1}`,
    nodes: [node(`n${index + 1}`, index === count - 1 ? 'needs_review' : 'upgradable')],
  }));
  return {
    pages,
    counts: { unchanged: 0, upgradable: count - 1, needs_review: 1, unresolvable: 0 },
    requiresReview: true,
    isUpToDate: false,
  } as never;
}

function inIntl(node_: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enRelease} timeZone="UTC">
      {node_}
    </NextIntlClientProvider>,
  );
}

describe('reviewing an update of a website with many pages', () => {
  const review = (count: number) =>
    inIntl(
      <MigrationReview websiteId="w1" migrationId="m1" plan={planOf(count)} onApplied={vi.fn()} />,
    );

  it('draws a few pages and offers the rest, instead of every page at once', () => {
    review(12);

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Show 7 more pages' }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more pages' }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(12);
    expect(screen.queryByRole('button', { name: /more page/ })).toBeNull();
  });

  it('puts the pages that need a decision first, wherever they were', () => {
    review(12);

    expect(screen.getAllByRole('heading', { level: 3 })[0]).toHaveTextContent('/page-12');
  });

  it('draws everything when there are only a few pages', () => {
    review(3);

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /more page/ })).toBeNull();
  });
});
