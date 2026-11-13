import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_AUDIT_FILTER } from '@modules/audit/application/contracts/audit-views';
import type {
  AuditAcrossWebsitesView,
  AuditEntryView,
  AuditTrailView,
} from '@modules/audit/application/contracts/audit-views';
import { AuditLog } from '@modules/audit/presentation/components/audit-log';

import { toPage } from '@lib/pagination';

vi.mock('@i18n/server', () => ({
  getTranslations: async () => (key: string) => key,
  getAppFormatters: async () => ({
    date: () => '2026-10-20',
    dateTime: () => '2026-10-20 10:00:00',
    relativeTime: () => '5 minutes ago',
  }),
}));

vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@modules/audit/presentation/components/audit-entry-list', () => ({
  AuditEntryList: ({
    toolbar,
    entries,
    isFiltered,
  }: {
    toolbar?: ReactNode;
    entries: readonly unknown[];
    isFiltered: boolean;
  }) => (
    <div data-testid="audit-entry-list" data-filtered={String(isFiltered)}>
      {toolbar}
      <div data-testid="count">{entries.length} entries</div>
    </div>
  ),
}));

vi.mock('@modules/audit/presentation/components/audit-filters', () => ({
  AuditFilters: () => <div data-testid="audit-filters">filters</div>,
}));

const mockEntry: AuditEntryView = {
  id: 'entry-1',
  websiteId: 'site-1',
  source: 'website',
  type: 'website.updated',
  severity: 'info',
  actorKind: 'member',
  actorId: 'user-1',
  details: { subjectId: null, before: null, after: null },
  occurredAt: new Date('2026-10-20T10:00:00Z'),
};

const mockTrail: AuditTrailView = {
  entries: toPage([mockEntry], 1, { page: 1, pageSize: 20 }),
  types: [{ source: 'website', type: 'website.updated', count: 1 }],
  isTypesTruncated: false,
  memberIds: ['user-1'],
  isMembersTruncated: false,
  readAt: new Date('2026-10-20T12:00:00Z'),
};

describe('AuditLog truncation alerts', () => {
  it('renders warnings when members, types, or websites are truncated', async () => {
    const acrossTrail: AuditAcrossWebsitesView = {
      ...mockTrail,
      reach: 'websites',
      websites: [{ id: 'site-1', name: 'Alpha' }],
      isMembersTruncated: true,
      isTypesTruncated: true,
      isWebsitesTruncated: true,
    };

    const element = await AuditLog({
      locale: 'en',
      pathname: '/audit',
      filter: EMPTY_AUDIT_FILTER,
      trail: acrossTrail,
      eventLabels: {},
      names: null,
      subjects: {},
      websites: acrossTrail.websites,
    });

    render(element);

    const list = screen.getByTestId('audit-entry-list');
    for (const text of ['filters.membersTruncated', 'filters.typesTruncated', 'across.truncated']) {
      const notice = screen.getByText(text);
      // Notices sit above the panel, never inside it.
      expect(list).not.toContainElement(notice);
      expect(notice.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('renders normally without alerts when nothing is truncated', async () => {
    const element = await AuditLog({
      locale: 'en',
      pathname: '/audit',
      filter: EMPTY_AUDIT_FILTER,
      trail: mockTrail,
      eventLabels: {},
      names: null,
      subjects: {},
    });

    render(element);

    expect(screen.queryByText('filters.membersTruncated')).not.toBeInTheDocument();
    expect(screen.queryByText('filters.typesTruncated')).not.toBeInTheDocument();
    expect(screen.queryByText('across.truncated')).not.toBeInTheDocument();
    expect(screen.getByTestId('audit-entry-list')).toBeInTheDocument();
  });
});

describe('AuditLog filter state', () => {
  const renderList = async (filter: typeof EMPTY_AUDIT_FILTER) => {
    render(
      await AuditLog({
        locale: 'en',
        pathname: '/audit',
        filter,
        trail: mockTrail,
        eventLabels: {},
        names: null,
        subjects: {},
      }),
    );
    return screen.getByTestId('audit-entry-list');
  };

  it('treats the unfiltered trail as not filtered', async () => {
    expect(await renderList(EMPTY_AUDIT_FILTER)).toHaveAttribute('data-filtered', 'false');
  });

  it('treats a trail narrowed only to one website as filtered', async () => {
    expect(await renderList({ ...EMPTY_AUDIT_FILTER, websiteId: 'site-1' })).toHaveAttribute(
      'data-filtered',
      'true',
    );
  });
});
