import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_AUDIT_FILTER } from '@modules/audit/application/contracts/audit-views';
import type { AuditEntryView } from '@modules/audit/application/contracts/audit-views';
import { AuditEntryList } from '@modules/audit/presentation/components/audit-entry-list';

vi.mock('@i18n/server', () => ({
  getTranslations: async () => (key: string) => key,
  getAppFormatters: async () => ({
    date: (input: Date, options?: { timeStyle?: string }) =>
      options?.timeStyle === undefined
        ? input.toISOString().slice(0, 10)
        : input.toISOString().slice(11, 16),
    dateTime: (input: Date) => `${input.toISOString().slice(0, 16)} (full)`,
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

describe('AuditEntryList with ResponsiveTable', () => {
  it('opens event details in a separate cell spanning the complete table', async () => {
    render(
      await AuditEntryList({
        locale: 'en',
        pathname: '/audit',
        filter: EMPTY_AUDIT_FILTER,
        entries: [mockEntry],
        total: 1,
        isFiltered: false,
        eventLabels: {},
        names: {},
        subjects: {},
        websites: [{ id: 'site-1', name: 'Town' }],
        readAt: mockEntry.occurredAt,
      }),
    );
    const trigger = screen.getByRole('button', { name: 'list.details' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    const details = screen.getByRole('region', { name: 'list.details' });
    expect(details.closest('td')).toHaveAttribute('colspan', '6');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(trigger);
    expect(screen.queryByRole('region', { name: 'list.details' })).not.toBeInTheDocument();
  });
  it('renders entries in a ResponsiveTable with column headers', async () => {
    const element = await AuditEntryList({
      locale: 'en',
      pathname: '/audit',
      filter: EMPTY_AUDIT_FILTER,
      entries: [mockEntry],
      total: 1,
      isFiltered: false,
      eventLabels: { 'website.updated': 'Website updated' },
      names: { 'user-1': 'Jane Doe' },
      subjects: {},
      readAt: new Date('2026-10-20T12:00:00Z'),
    });

    render(element);

    expect(screen.getByRole('table', { name: 'list.label' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'columns.event' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'columns.area' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'details.who' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'details.when' })).toBeInTheDocument();
    expect(screen.getByText('Website updated')).toBeInTheDocument();
    expect(screen.getAllByText('Jane Doe')[0]).toBeInTheDocument();
  });

  it('renders website column when websites are provided', async () => {
    const element = await AuditEntryList({
      locale: 'en',
      pathname: '/audit',
      filter: EMPTY_AUDIT_FILTER,
      entries: [mockEntry],
      total: 1,
      isFiltered: false,
      eventLabels: { 'website.updated': 'Website updated' },
      names: { 'user-1': 'Jane Doe' },
      subjects: {},
      websites: [{ id: 'site-1', name: 'Alpha Site' }],
      readAt: new Date('2026-10-20T12:00:00Z'),
    });

    render(element);

    expect(screen.getByRole('columnheader', { name: 'details.website' })).toBeInTheDocument();
    expect(screen.getAllByText('Alpha Site')[0]).toBeInTheDocument();
  });

  it('renders empty state when there are no entries', async () => {
    const element = await AuditEntryList({
      locale: 'en',
      pathname: '/audit',
      filter: EMPTY_AUDIT_FILTER,
      entries: [],
      total: 0,
      isFiltered: false,
      eventLabels: {},
      names: null,
      subjects: {},
      readAt: new Date('2026-10-20T12:00:00Z'),
    });

    render(element);

    expect(screen.getByText('list.empty')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'filters.reset' })).not.toBeInTheDocument();
  });

  it('offers to reset the filters when nothing matches them', async () => {
    render(
      await AuditEntryList({
        locale: 'en',
        pathname: '/audit',
        filter: { ...EMPTY_AUDIT_FILTER, websiteId: 'site-1' },
        entries: [],
        total: 0,
        isFiltered: true,
        eventLabels: {},
        names: null,
        subjects: {},
        readAt: new Date('2026-10-20T12:00:00Z'),
      }),
    );

    expect(screen.getByText('list.noMatch')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'filters.reset' })).toHaveAttribute('href', '/audit');
  });

  it('groups entries under a heading per day and shows only the time of day in each row', async () => {
    const yesterday = { ...mockEntry, id: 'entry-y', occurredAt: new Date('2026-10-19T20:31:00Z') };
    const earlier = { ...mockEntry, id: 'entry-0', occurredAt: new Date('2026-10-18T20:31:00Z') };
    const sameDay = { ...earlier, id: 'entry-00', occurredAt: new Date('2026-10-18T08:00:00Z') };
    render(
      await AuditEntryList({
        locale: 'en',
        pathname: '/audit',
        filter: EMPTY_AUDIT_FILTER,
        entries: [mockEntry, yesterday, earlier, sameDay],
        total: 4,
        isFiltered: false,
        eventLabels: {},
        names: null,
        subjects: {},
        readAt: new Date('2026-10-20T12:00:00Z'),
      }),
    );

    expect(screen.getAllByRole('rowheader').map((heading) => heading.textContent)).toEqual([
      'details.today',
      'details.yesterday',
      '2026-10-18',
    ]);
    const times = screen.getAllByRole('cell').flatMap((cell) => [...cell.querySelectorAll('time')]);
    expect(times.map((time) => time.textContent)).toEqual(['10:00', '20:31', '20:31', '08:00']);
    expect(times[2]).toHaveAttribute('dateTime', '2026-10-18T20:31:00.000Z');
  });
});
