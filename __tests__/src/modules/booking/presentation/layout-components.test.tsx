import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BookingAdminPage } from '@modules/booking/presentation/components/shared/booking-admin-page';
import { DetailFact } from '@modules/booking/presentation/components/shared/detail-fact';
import { DetailPanel } from '@modules/booking/presentation/components/shared/detail-panel';
import { FormSection } from '@modules/booking/presentation/components/shared/form-section';
import { StatusChip } from '@modules/booking/presentation/components/shared/status-chip';

import { Check } from '@components/icons/icons';
import { FilterBar, FilterSearchField } from '@components/shared/filter-bar';

vi.mock('@i18n/server', () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
}));
vi.mock('@components/providers/i18n-provider', () => ({
  I18nProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('BookingAdminPage', () => {
  it('is the page: one h1 with its description, the main action, and the content', async () => {
    render(
      await BookingAdminPage({
        locale: 'en',
        websiteId: 'w1',
        title: 'Bookings',
        description: 'Manage appointments.',
        actions: <button type="button">Create</button>,
        children: <p>the content</p>,
      }),
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Bookings' })).toBeInTheDocument();
    expect(screen.getByText('Manage appointments.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(screen.getByText('the content')).toBeInTheDocument();
  });

  it('draws no empty action area when the page has no main action', async () => {
    const { container } = render(
      await BookingAdminPage({
        locale: 'en',
        websiteId: 'w1',
        title: 'Bookings',
        children: <p>the content</p>,
      }),
    );

    expect(container.querySelector('h1')?.parentElement?.parentElement?.children).toHaveLength(1);
  });
});

describe('StatusChip', () => {
  it('draws the word with an icon that assistive technology skips', () => {
    const { container } = render(
      <StatusChip tone="success" icon={Check}>
        Done
      </StatusChip>,
    );

    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('DetailPanel', () => {
  it('is a region named by its title, with labelled facts and the actions that belong to it', () => {
    render(
      <DetailPanel
        title="Passport"
        subtitle="Tue 22 Apr, 09:00"
        status={<span>Open</span>}
        actions={<button type="button">Assign</button>}
      >
        <DetailFact label="Citizen">Julia Becker</DetailFact>
        <DetailFact label="Needs">Counter 3</DetailFact>
      </DetailPanel>,
    );

    const region = screen.getByRole('region', { name: 'Passport' });
    expect(region).toHaveTextContent('Tue 22 Apr, 09:00');
    expect(region).toHaveTextContent('Open');
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Citizen',
      'Needs',
    ]);
    expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual([
      'Julia Becker',
      'Counter 3',
    ]);
    expect(screen.getByRole('button', { name: 'Assign' })).toBeInTheDocument();
  });
});

describe('FormSection', () => {
  it('groups its fields under a name, and explains the group', () => {
    render(
      <FormSection title="Deadlines" description="When people can still change a booking.">
        <label>
          Cancel until
          <input />
        </label>
      </FormSection>,
    );

    const group = screen.getByRole('group', { name: 'Deadlines' });
    expect(group).toHaveAccessibleDescription('When people can still change a booking.');
    expect(group).toContainElement(screen.getByLabelText('Cancel until'));
  });
});

describe('FilterBar', () => {
  function bar() {
    return render(
      <FilterBar
        action="/bookings/w1/list"
        label="Filter bookings"
        applyLabel="Apply"
        resetLabel="Reset"
        resetHref="/bookings/w1/list"
      >
        <FilterSearchField
          id="q"
          name="q"
          label="Search bookings"
          defaultValue="becker"
          placeholder="Name or number"
        />
      </FilterBar>,
    );
  }

  it('is a search landmark that submits the filters to the address as a GET form', () => {
    bar();

    const form = screen.getByRole('search', { name: 'Filter bookings' });
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/bookings/w1/list');
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveAttribute('type', 'submit');
  });

  it('keeps the typed search, labelled for a screen reader, and can be reset by a link', () => {
    bar();

    expect(screen.getByRole('searchbox', { name: 'Search bookings' })).toHaveValue('becker');
    expect(screen.getByRole('link', { name: 'Reset' })).toHaveAttribute(
      'href',
      '/bookings/w1/list',
    );
  });
});
