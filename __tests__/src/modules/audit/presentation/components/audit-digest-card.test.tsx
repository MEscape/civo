import type { ComponentProps } from 'react';

import { render, screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { AuditDigestCard } from '@modules/audit/presentation/components/audit-digest-card';
import en from '@modules/audit/presentation/i18n/en.json';

import { createAppFormatters } from '@i18n/formatters/app-formatters';

import { entryView } from '../support/trail-view';

vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));
vi.mock('@i18n/server', () => ({
  getTranslations: async () => createTranslator({ locale: 'en', messages: en, namespace: 'audit' }),
  getAppFormatters: async () => createAppFormatters('en', 'UTC'),
}));
vi.mock('@modules/audit/presentation/components/audit-activity-chart.client', () => ({
  AuditActivityChart: () => null,
}));

describe('AuditDigestCard', () => {
  it('keeps every recent entry in a named region that keyboard users can reach', async () => {
    render(
      await AuditDigestCard({
        locale: 'en',
        auditHref: '/audit',
        eventLabels: {},
        names: null,
        digest: {
          period: '30d',
          total: 5,
          warnings: 0,
          recent: Array.from({ length: 5 }, (_, index) => ({
            ...entryView,
            id: `event-${index}`,
            type: `event.${index}`,
          })),
          days: [],
        },
      }),
    );

    const recent = screen.getByRole('region', { name: en.audit.overview.latest });
    recent.focus();
    expect(recent).toHaveFocus();
    expect(within(recent).getAllByRole('listitem')).toHaveLength(5);
    expect(within(recent).getByText('event.4')).toBeInTheDocument();
    expect(recent).not.toContainElement(
      screen.getByRole('heading', { name: en.audit.overview.latest }),
    );
  });

  it('shows an empty trail without a misleading chart or fake entries', async () => {
    render(
      await AuditDigestCard({
        locale: 'en',
        auditHref: '/audit',
        eventLabels: {},
        names: null,
        digest: { period: '30d', total: 0, warnings: 0, recent: [], days: [] },
      }),
    );
    expect(screen.getByText(en.audit.overview.empty)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/audit');
  });

  it('keeps accessible chart totals consistent with the warning breakdown and names recent events', async () => {
    render(
      await AuditDigestCard({
        locale: 'en',
        auditHref: '/audit',
        eventLabels: { 'website.updated': 'Website details changed' },
        names: { 'actor-1': 'Ada' },
        digest: {
          period: '30d',
          total: 3,
          warnings: 1,
          recent: [
            entryView,
            { ...entryView, id: 'event-2', type: 'unknown.event', severity: 'warn' },
          ],
          days: [
            { day: '2026-10-28', total: 0, warnings: 0 },
            { day: '2026-10-29', total: 3, warnings: 1 },
          ],
        },
      }),
    );
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(2);
    const cells = within(screen.getByRole('table')).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('2');
    expect(cells[1]).toHaveTextContent('1');
    expect(screen.getByText('Website details changed')).toBeInTheDocument();
    expect(screen.getByText('unknown.event')).toBeInTheDocument();
    expect(screen.getAllByText('Ada')).toHaveLength(2);
  });
});
