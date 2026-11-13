import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_AUDIT_FILTER } from '@modules/audit/application/contracts/audit-views';
import { AuditFilters } from '@modules/audit/presentation/components/audit-filters';

vi.mock('@i18n/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('audit filters', () => {
  it('keeps missing selected events and former members available until filters are reset', async () => {
    const props = {
      locale: 'en' as const,
      pathname: '/audit',
      filter: {
        ...EMPTY_AUDIT_FILTER,
        type: 'website.changed',
        actor: { kind: 'member' as const, id: 'former' },
      },
      pageSize: 50,
      types: [],
      eventLabels: { 'website.changed': 'Legacy event' },
      members: [],
    };
    const { rerender } = render(await AuditFilters(props));
    expect(screen.getByRole('combobox', { name: 'filters.event' })).toHaveTextContent(
      'Legacy event',
    );
    expect(screen.getByRole('combobox', { name: 'filters.who' })).toHaveTextContent(
      'actors.formerMember',
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'filters.onlyWarnings' }));

    rerender(await AuditFilters({ ...props, filter: EMPTY_AUDIT_FILTER }));
    expect(screen.getByRole('combobox', { name: 'filters.event' })).toHaveTextContent(
      'filters.anyEvent',
    );
    expect(screen.getByRole('combobox', { name: 'filters.who' })).toHaveTextContent(
      'filters.anyone',
    );
    expect(screen.getByRole('checkbox', { name: 'filters.onlyWarnings' })).not.toBeChecked();
    expect(screen.getByRole('search', { name: 'filters.label' })).toHaveAttribute('method', 'get');
  });

  it('keeps the chosen page size when the filters are applied', async () => {
    render(
      await AuditFilters({
        locale: 'en',
        pathname: '/audit',
        filter: EMPTY_AUDIT_FILTER,
        pageSize: 50,
        types: [],
        eventLabels: {},
        members: [],
      }),
    );
    const form = screen.getByRole('search', { name: 'filters.label' });
    expect(new FormData(form as HTMLFormElement).get('pageSize')).toBe('50');
  });
});
