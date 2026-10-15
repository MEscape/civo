import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MigrationPanel } from '@modules/release/presentation/components/migration-panel';
import { PublishButton } from '@modules/release/presentation/components/publish-button';
import { ReleaseHistoryPanel } from '@modules/release/presentation/components/release-history-panel';
import type { ReleaseSummaryDto } from '@modules/release/presentation/dto/release-dto';
import type { ReleaseHistoryDto } from '@modules/release/presentation/dto/release-history-dto';
import enRelease from '@modules/release/presentation/i18n/en.json';

const { publishReleaseAction, rollbackReleaseAction } = vi.hoisted(() => ({
  publishReleaseAction: vi.fn(),
  rollbackReleaseAction: vi.fn(),
}));

vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock('@i18n/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAppFormatters: () => ({
    dateTime: (value: string) => value,
    date: (value: string) => value,
  }),
}));
vi.mock('@modules/release/presentation/actions/publish-release-action', () => ({
  publishReleaseAction,
}));
vi.mock('@modules/release/presentation/actions/rollback-release-action', () => ({
  rollbackReleaseAction,
}));
vi.mock('@modules/release/presentation/actions/propose-migration-action', () => ({
  proposeMigrationAction: vi.fn(),
}));

const HISTORY: ReleaseHistoryDto = {
  activeReleaseId: 'r2',
  releases: [
    {
      id: 'r2',
      websiteId: 'w1',
      releaseNumber: 2,
      status: 'published',
      isActive: true,
      canRollback: false,
      note: 'Contact page reworked',
      publishedBy: 'actor-anna',
      changes: {
        pageChangeCount: 2,
        pageChanges: [
          { path: '', title: 'Home', kind: 'changed' },
          { path: 'booking', title: 'Booking', kind: 'added' },
        ],
        websiteChanged: false,
        themeChanged: false,
      },
      publishedAt: '2026-10-12T10:00:00.000Z',
      createdAt: '2026-10-12T10:00:00.000Z',
    },
    {
      id: 'r1',
      websiteId: 'w1',
      releaseNumber: 1,
      status: 'published',
      isActive: false,
      canRollback: true,
      note: null,
      publishedBy: null,
      changes: null,
      publishedAt: '2026-10-11T10:00:00.000Z',
      createdAt: '2026-10-11T10:00:00.000Z',
    },
  ],
  total: 2,
};

const [LIVE, EARLIER] = HISTORY.releases as [ReleaseSummaryDto, ReleaseSummaryDto];

const AUTHORS = { 'actor-anna': 'Anna Müller' };

const DRAFT = {
  pageCount: 3,
  blockedPageCount: 0,
  pageChangeCount: 2,
  pageChanges: [
    { path: '', title: 'Home', kind: 'changed' },
    { path: 'booking', title: 'Booking', kind: 'added' },
  ],
  websiteChanged: false,
  themeChanged: false,
  hasChanges: true,
} as const;

function inIntl(node: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enRelease} timeZone="UTC">
      {node}
    </NextIntlClientProvider>,
  );
}

beforeAll(() => {
  // The test DOM has no modal dialogs; this is the part of them the components rely on.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

beforeEach(() => {
  publishReleaseAction.mockReset();
  rollbackReleaseAction.mockReset();
});

describe('the release history', () => {
  it('shows each release with its note, date and what it changed', () => {
    inIntl(
      <ReleaseHistoryPanel
        websiteId="w1"
        history={HISTORY}
        page={1}
        mayRollback={false}
        authors={AUTHORS}
      />,
    );

    const [, live, earlier] = screen.getAllByRole('row');
    expect(live).toHaveTextContent('Release #2');
    expect(live).toHaveTextContent('Live');
    expect(live).toHaveTextContent('Contact page reworked');
    expect(live).toHaveTextContent('2 pages');
    expect(live).toHaveTextContent('Edited: Home');
    expect(live).toHaveTextContent('New: Booking');
    expect(earlier).toHaveTextContent('Release #1');
    expect(earlier).not.toHaveTextContent('Live');
    expect(earlier).toHaveTextContent('No details kept');
  });

  it('draws no restore control for a reader, who can still look at a release', () => {
    inIntl(
      <ReleaseHistoryPanel
        websiteId="w1"
        history={HISTORY}
        page={1}
        mayRollback={false}
        authors={AUTHORS}
      />,
    );

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link', { name: 'Preview release #1' })).toHaveAttribute(
      'href',
      '/websites/w1/releases/r1/preview',
    );
  });

  it('says who published, when the person can be named', () => {
    inIntl(
      <ReleaseHistoryPanel
        websiteId="w1"
        history={HISTORY}
        page={1}
        mayRollback={false}
        authors={AUTHORS}
      />,
    );

    const [, live, earlier] = screen.getAllByRole('row');
    expect(live).toHaveTextContent('Published by Anna Müller');
    expect(earlier).not.toHaveTextContent('Anna');
  });

  it('tints the live release and names a rolled back one so it can be read', () => {
    inIntl(
      <ReleaseHistoryPanel
        websiteId="w1"
        history={{
          ...HISTORY,
          releases: [LIVE, { ...EARLIER, status: 'rolled_back' }],
        }}
        page={1}
        mayRollback={false}
        authors={AUTHORS}
      />,
    );

    const [, live, earlier] = screen.getAllByRole('row');
    expect(live).toHaveClass('bg-success-subtle/40');
    expect(earlier).toHaveTextContent('Rolled back');
  });

  it('says a former member published when the id has no name any more', () => {
    inIntl(
      <ReleaseHistoryPanel
        websiteId="w1"
        history={{
          ...HISTORY,
          releases: [LIVE, { ...EARLIER, publishedBy: 'actor-gone' }],
        }}
        page={1}
        mayRollback={false}
        authors={AUTHORS}
      />,
    );

    expect(screen.getAllByRole('row')[2]).toHaveTextContent('Published by a former member');
  });

  it('says nothing about who published when accounts cannot be named at all', () => {
    inIntl(
      <ReleaseHistoryPanel
        websiteId="w1"
        history={HISTORY}
        page={1}
        mayRollback={false}
        authors={null}
      />,
    );

    expect(screen.queryByText(/Published by/)).toBeNull();
  });

  it('counts the releases in the footer', () => {
    inIntl(
      <ReleaseHistoryPanel
        websiteId="w1"
        history={HISTORY}
        page={1}
        mayRollback={false}
        authors={AUTHORS}
      />,
    );

    expect(screen.getByText('2 of 2 releases')).toBeInTheDocument();
  });

  it('asks before restoring, and only then restores', async () => {
    rollbackReleaseAction.mockResolvedValue({ ok: true, data: { releaseNumber: 1 } });
    inIntl(
      <ReleaseHistoryPanel
        websiteId="w1"
        history={HISTORY}
        page={1}
        mayRollback
        authors={AUTHORS}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Restore release #1/ }));
    expect(rollbackReleaseAction).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog', { name: 'Restore release #1?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(rollbackReleaseAction).toHaveBeenCalledWith({ websiteId: 'w1', releaseId: 'r1' });
    });
  });

  it('keeps everything as it is when the question is cancelled', () => {
    inIntl(
      <ReleaseHistoryPanel
        websiteId="w1"
        history={HISTORY}
        page={1}
        mayRollback
        authors={AUTHORS}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Restore release #1/ }));
    const dialog = screen.getByRole('dialog', { name: 'Restore release #1?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(rollbackReleaseAction).not.toHaveBeenCalled();
  });
});

describe('publishing', () => {
  it('reviews what goes live, with the number the release will get', () => {
    inIntl(<PublishButton websiteId="w1" draft={DRAFT} nextNumber={3} isFirst={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Review & publish' }));

    const dialog = screen.getByRole('dialog', { name: 'Publish changes' });
    expect(within(dialog).getByText('Home')).toBeInTheDocument();
    expect(within(dialog).getByText('Booking')).toBeInTheDocument();
    expect(within(dialog).getByText('New')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Publish as release #3' })).toBeEnabled();
  });

  it('sends the note with the publish', async () => {
    publishReleaseAction.mockResolvedValue({ ok: true, data: { releaseNumber: 3 } });
    inIntl(<PublishButton websiteId="w1" draft={DRAFT} nextNumber={3} isFirst={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Review & publish' }));
    fireEvent.change(screen.getByLabelText('Note (optional)'), {
      target: { value: 'Contact details updated' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish as release #3' }));

    await waitFor(() => {
      expect(publishReleaseAction).toHaveBeenCalledWith({
        websiteId: 'w1',
        note: 'Contact details updated',
      });
    });
  });

  it('is not offered while a page blocks it', () => {
    inIntl(<PublishButton websiteId="w1" draft={DRAFT} nextNumber={3} isFirst={false} disabled />);

    expect(screen.getByRole('button', { name: 'Review & publish' })).toBeDisabled();
  });
});

describe('component updates', () => {
  const history = { migrations: [] } as never;
  const LABELS = { hero: 'Hero banner', serviceGrid: 'Services' };
  const AVAILABLE = {
    available: 2,
    needReview: 1,
    unresolvable: 0,
    components: [
      {
        type: 'hero',
        fromVersion: 1,
        toVersion: 2,
        usageCount: 1,
        pageCount: 1,
        pagePaths: [''],
        status: 'needs_review',
        addedFields: ['phoneNumber'],
        conflictFields: ['title'],
      },
      {
        type: 'serviceGrid',
        fromVersion: 3,
        toVersion: 4,
        usageCount: 2,
        pageCount: 2,
        pagePaths: ['', 'services'],
        status: 'upgradable',
        addedFields: [],
        conflictFields: [],
      },
    ],
  } as const satisfies NonNullable<Parameters<typeof MigrationPanel>[0]['updates']>;
  const renderPanel = (updates: Parameters<typeof MigrationPanel>[0]['updates'], mayRun: boolean) =>
    inIntl(
      <MigrationPanel
        websiteId="w1"
        history={history}
        historyTotal={0}
        updates={updates}
        componentLabels={LABELS}
        checkedAt="2026-10-15T10:42:00.000Z"
        mayRun={mayRun}
      />,
    );

  it('explains the way updates go as steps, not as a sentence', () => {
    renderPanel(AVAILABLE, true);

    const steps = screen.getByRole('list', { name: 'How component updates work' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
  });

  it('names the components, their versions and how ready each is, without a click', () => {
    renderPanel(AVAILABLE, true);

    expect(screen.getByText('2 updates available')).toBeInTheDocument();
    expect(screen.getByText('1 compatible')).toBeInTheDocument();
    expect(screen.getByText('1 need review')).toBeInTheDocument();
    const hero = screen.getByRole('button', { name: /Hero banner/ });
    expect(hero).toHaveTextContent('v1 → v2');
    expect(hero).toHaveTextContent('Needs review');
    const services = screen.getByRole('button', { name: /Services/ });
    expect(services).toHaveTextContent('2 pages');
    expect(services).toHaveTextContent('Compatible');
    expect(screen.getByRole('button', { name: 'Review changes' })).toBeInTheDocument();
  });

  it('opens a component to say where it is used and what changes for it', () => {
    renderPanel(AVAILABLE, true);

    fireEvent.click(screen.getByRole('button', { name: /Hero banner/ }));

    expect(screen.getByText('On these pages')).toBeInTheDocument();
    expect(screen.getByText('phoneNumber')).toBeInTheDocument();
    expect(screen.getByText('title')).toBeInTheDocument();
  });

  it('says when it was checked', () => {
    renderPanel(AVAILABLE, true);

    expect(screen.getByText(/Checked/)).toBeInTheDocument();
  });

  it('keeps checking again as a quiet icon button', () => {
    renderPanel({ available: 0, needReview: 0, unresolvable: 0, components: [] }, true);

    expect(screen.getByRole('button', { name: 'Check for updates' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review changes' })).toBeNull();
    expect(screen.getByText('All components are up to date')).toBeInTheDocument();
  });

  it('does not call components up to date when some cannot be updated at all', () => {
    renderPanel(
      {
        available: 0,
        needReview: 0,
        unresolvable: 1,
        components: [
          {
            type: 'hero',
            fromVersion: 9,
            toVersion: 1,
            usageCount: 1,
            pageCount: 1,
            pagePaths: [''],
            status: 'unresolvable',
            addedFields: [],
            conflictFields: [],
          },
        ],
      },
      true,
    );

    expect(screen.getByText('1 component cannot be updated')).toBeInTheDocument();
    expect(screen.queryByText('All components are up to date')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Review changes' })).toBeNull();
  });

  it('asks for a first release before there is anything to check', () => {
    renderPanel(null, true);

    expect(screen.queryByRole('button', { name: 'Review changes' })).toBeNull();
    expect(screen.getByText(/Publish your website first/)).toBeInTheDocument();
  });

  it('does not offer to review to someone who may not run migrations', () => {
    renderPanel(AVAILABLE, false);

    expect(screen.queryByRole('button', { name: 'Review changes' })).toBeNull();
    expect(screen.getByText('2 updates available')).toBeInTheDocument();
  });
});
