import { fireEvent, screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { TeamList } from '@modules/booking/presentation/components/team/team-list';
import type { TeamMemberSummaryDto } from '@modules/booking/presentation/dto/team-dto';
import {
  parseTeamListParams,
  teamListHref,
  teamSlice,
} from '@modules/booking/presentation/forms/team-list';
import type { TeamListView } from '@modules/booking/presentation/forms/team-list';
import enBooking from '@modules/booking/presentation/i18n/en.json';
import { ANY_FILTER } from '@modules/booking/presentation/schemas/parse-service-list-input';

import enApp from '@i18n/messages/en.json';

import { expectNoViolations } from '../../../support/a11y';
import { officeWeek } from '../support/location-inputs';
import { renderServer } from '../support/server-render';

vi.mock('@i18n/server', () => ({
  getTranslations: ({ namespace }: { namespace: 'booking' | 'app' }) =>
    Promise.resolve(
      createTranslator({
        locale: 'en',
        messages: { ...enBooking, app: enApp },
        namespace,
      } as never),
    ),
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@modules/booking/presentation/actions/preview-team-member-removal-action', () => ({
  previewTeamMemberRemovalAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/remove-team-member-action', () => ({
  removeTeamMemberAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/move-team-member-action', () => ({
  moveTeamMemberAction: vi.fn(),
}));

const LOCATION = { id: 'loc-1', name: 'Bürgerbüro Mitte' };

const member = (
  id: string,
  name: string,
  overrides: Partial<TeamMemberSummaryDto> = {},
): TeamMemberSummaryDto => ({
  id,
  name,
  weekly: officeWeek(),
  absences: [],
  coverage: [],
  qualifications: [],
  version: '2027-01-10T08:30:00.000Z',
  ...overrides,
});

const TEAM = [
  member('e-1', 'Anna Müller', {
    qualifications: ['Ausweise'],
    absences: [{ from: '2027-02-01', to: '2027-02-05' }],
  }),
  member('e-2', 'Jan Koch', { qualifications: ['Meldewesen', 'Ausweise'] }),
  member('e-3', 'Lisa Hoffmann'),
];

const VIEW: TeamListView = {
  search: undefined,
  qualification: undefined,
  pageSize: 10,
};

async function renderList(
  members: readonly TeamMemberSummaryDto[],
  overrides: {
    view?: Partial<TeamListView>;
    page?: number;
    candidateCount?: number;
    usersHref?: string;
  } = {},
) {
  const view = { ...VIEW, ...overrides.view };
  const slice = teamSlice(members, view, overrides.page ?? 1);
  return renderServer(
    await TeamList({
      locale: 'en',
      websiteId: 'site',
      location: LOCATION,
      page: slice.page,
      view,
      qualifications: slice.qualifications,
      candidateCount: overrides.candidateCount ?? 0,
      moveTargets: [{ id: 'loc-2', name: 'Bürgerbüro West' }],
      usersHref: overrides.usersHref,
    }),
  );
}

describe('the team of a location', () => {
  it('lists each employee with their week, qualifications, absences and whether they have seen a change', async () => {
    const { container } = await renderList(TEAM);

    const rows = screen
      .getAllByRole('row')
      .filter((row) => within(row).queryAllByRole('columnheader').length === 0);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Anna Müller');
    expect(rows[0]).toHaveTextContent('Ausweise');
    expect(rows[0]).toHaveTextContent('1 absence');
    expect(rows[2]).toHaveTextContent('none');
    expect(screen.getByRole('link', { name: 'Edit Anna Müller' })).toHaveAttribute(
      'href',
      '/bookings/site/locations/loc-1/team/e-1',
    );
    expect(screen.getByText('3 people')).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it('has the search and the qualification as its one strip of filters', async () => {
    await renderList(TEAM);

    expect(screen.getByRole('search', { name: 'Filter the team' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /status/i })).toBeNull();
  });

  it('offers moving and removing a person from their row, next to editing their calendar', async () => {
    await renderList(TEAM);

    expect(screen.getAllByRole('button', { name: /^More actions for / })).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Edit Anna Müller' })).toBeInTheDocument();
  });

  it('opens a row to the week and the absences', async () => {
    await renderList(TEAM);
    const row = screen.getByText('Anna Müller').closest('tr');
    expect(row).not.toBeNull();

    const trigger = screen.getByRole('button', { name: 'Anna Müller' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(screen.getByText('Working hours')).toBeInTheDocument();
    expect(screen.getByText(/February 1, 2027/)).toBeInTheDocument();
  });

  it('says it is the filter that found nothing, with a way back', async () => {
    await renderList(TEAM, { view: { search: 'zzz' } });

    expect(screen.getByText('No employee found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reset selection' })).toHaveAttribute(
      'href',
      '/bookings/site/locations/loc-1/team',
    );
  });

  it('says so when nobody has a calendar yet, and where a member gets the role that lets them have one', async () => {
    await renderList([], { usersHref: '/websites/site/users' });

    expect(screen.getByText('Nobody has a calendar here yet')).toBeInTheDocument();
    expect(screen.getByText(/Give someone that role under Users/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage members' })).toHaveAttribute(
      'href',
      '/websites/site/users',
    );
  });

  it('points to "Add employee" when members with the role are waiting for a calendar', async () => {
    await renderList([], { candidateCount: 2 });

    expect(screen.getByText(/2 members have the role “Employee”/)).toBeInTheDocument();
    expect(screen.getByText(/Add employee/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Manage members' })).not.toBeInTheDocument();
  });

  it('pages a long team and keeps the filters in the page links', async () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      member(`e-${String(index)}`, `Person ${String(index + 10)}`, {
        qualifications: ['Ausweise'],
      }),
    );
    await renderList(many, { view: { qualification: 'Ausweise' } });

    expect(screen.getAllByRole('link', { name: /^Edit Person/ })).toHaveLength(10);
    const next = screen.getByRole('link', { name: 'Next' });
    expect(next).toHaveAttribute('href', expect.stringContaining('qualification=Ausweise'));
    expect(next).toHaveAttribute('href', expect.stringContaining('page=2'));
  });
});

describe('the address of the team list', () => {
  it('reads a hand-made address without trusting it', () => {
    const { view, page } = parseTeamListParams({
      q: ['  anna ', 'x'],
      qualification: ANY_FILTER,
      page: '0',
      pageSize: '9999',
    });
    expect(view).toEqual({
      search: 'anna',
      qualification: undefined,
      pageSize: 50,
    });
    expect(page).toBe(1);
  });

  it('keeps every filter when it builds the address of another page', () => {
    expect(
      teamListHref('/team', { search: 'an', qualification: 'Ausweise', pageSize: 10 }, { page: 3 }),
    ).toBe('/team?q=an&qualification=Ausweise&page=3&pageSize=10');
  });

  it('puts a page past the end on the last one, and filters by name and qualification', () => {
    const slice = teamSlice(TEAM, { ...VIEW, pageSize: 2 }, 9);
    expect(slice.page.page).toBe(2);
    expect(slice.page.items.map(({ name }) => name)).toEqual(['Lisa Hoffmann']);
    expect(teamSlice(TEAM, { ...VIEW, search: 'JAN' }, 1).page.total).toBe(1);
    expect(teamSlice(TEAM, { ...VIEW, qualification: 'Ausweise' }, 1).page.total).toBe(2);
    expect(slice.qualifications).toEqual(['Ausweise', 'Meldewesen']);
  });
});
