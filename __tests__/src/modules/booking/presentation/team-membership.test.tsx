import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TeamMemberActions } from '@modules/booking/presentation/components/team/team-member-actions.client';
import type { TeamMemberDto } from '@modules/booking/presentation/dto/team-dto';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import enApp from '@i18n/messages/en.json';

import { officeWeek } from '../support/location-inputs';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  preview: vi.fn(),
  remove: vi.fn(),
  move: vi.fn(),
}));

vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: mocks.push, refresh: vi.fn() }),
}));
vi.mock('@modules/booking/presentation/actions/preview-team-member-removal-action', () => ({
  previewTeamMemberRemovalAction: mocks.preview,
}));
vi.mock('@modules/booking/presentation/actions/remove-team-member-action', () => ({
  removeTeamMemberAction: mocks.remove,
}));
vi.mock('@modules/booking/presentation/actions/move-team-member-action', () => ({
  moveTeamMemberAction: mocks.move,
}));

const MEMBER: TeamMemberDto = {
  id: 'e-1',
  name: 'Anna Müller',
  weekly: officeWeek(),
  absences: [],
  coverage: [],
  qualifications: ['ausweise'],
  websiteId: 'site',
  location: { id: 'loc-1', name: 'Bürgerbüro Mitte' },
  coverageChoices: [{ id: 'loc-2', name: 'Bürgerbüro West' }],
  locationWeekly: officeWeek(),
  knownQualifications: [],
  version: '2027-01-10T08:30:00.000Z',
};

const AFFECTED = {
  bookingId: 'b-1',
  serviceId: 's-1',
  timeZone: 'Europe/Berlin',
  start: '2027-02-01T10:00:00+01:00',
  end: '2027-02-01T10:30:00+01:00',
  reason: 'resource-unavailable',
};

const SUBJECT = {
  websiteId: MEMBER.websiteId,
  id: MEMBER.id,
  name: MEMBER.name,
  version: MEMBER.version,
  locationId: MEMBER.location.id,
};

const inEnglish = (moveTargets = MEMBER.coverageChoices) =>
  render(
    <NextIntlClientProvider
      locale="en"
      messages={{ ...enBooking, app: enApp }}
      timeZone="Europe/Berlin"
    >
      <TeamMemberActions subject={SUBJECT} moveTargets={moveTargets} />
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('where a manager puts a person: out of the team, or into another', () => {
  it('removes after asking, and goes straight on when no booking is reached', async () => {
    mocks.preview.mockResolvedValue({ ok: true, data: { affected: [], isTruncated: false } });
    mocks.remove.mockResolvedValue({
      ok: true,
      data: { websiteId: 'site', employeeId: 'e-1', releasedBookings: 0 },
    });
    inEnglish();

    fireEvent.click(screen.getByRole('button', { name: 'Remove from team' }));
    const question = await screen.findByRole('alertdialog', { hidden: true });
    expect(within(question).getByText('Remove Anna Müller from the team?')).toBeInTheDocument();
    fireEvent.click(
      within(question).getByRole('button', { name: 'Remove from team', hidden: true }),
    );

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith('/bookings/site/locations/loc-1/team');
    });
    expect(mocks.remove).toHaveBeenCalledWith({
      websiteId: 'site',
      employeeId: 'e-1',
      expectedVersion: MEMBER.version,
      acknowledgeImpact: false,
    });
  });

  it('shows the bookings that become open first, and removes only after they were seen', async () => {
    mocks.preview.mockResolvedValue({
      ok: true,
      data: { affected: [AFFECTED], isTruncated: false },
    });
    mocks.remove.mockResolvedValue({
      ok: true,
      data: { websiteId: 'site', employeeId: 'e-1', releasedBookings: 1 },
    });
    inEnglish();

    fireEvent.click(screen.getByRole('button', { name: 'Remove from team' }));
    const question = await screen.findByRole('alertdialog', { hidden: true });
    fireEvent.click(
      within(question).getByRole('button', { name: 'Remove from team', hidden: true }),
    );

    expect(
      await screen.findByText(/Nothing is cancelled\. The person is taken off/),
    ).toBeInTheDocument();
    expect(mocks.remove).not.toHaveBeenCalled();
    const review = screen
      .getAllByRole('dialog', { hidden: true })
      .find((dialog) => within(dialog).queryByText(/taken off these bookings/))!;
    const go = within(review).getByRole('button', { name: 'Remove from team', hidden: true });
    // The look at the bookings is still settling; the way on opens once it has.
    await waitFor(() => {
      expect(go).toBeEnabled();
    });
    fireEvent.click(go);

    await waitFor(() => {
      expect(mocks.remove).toHaveBeenCalledWith(
        expect.objectContaining({ acknowledgeImpact: true }),
      );
    });
  });

  it('moves only once a location is chosen, and goes to the calendar in the new team', async () => {
    mocks.preview.mockResolvedValue({ ok: true, data: { affected: [], isTruncated: false } });
    mocks.move.mockResolvedValue({ ok: true, data: { id: 'e-9' } });
    inEnglish();

    fireEvent.click(screen.getByRole('button', { name: 'Move to another team' }));
    const dialog = await screen.findByRole('dialog', { name: /Move Anna Müller/, hidden: true });
    const confirm = within(dialog).getByRole('button', {
      name: 'Move to another team',
      hidden: true,
    });
    expect(confirm).toBeDisabled();

    fireEvent.click(within(dialog).getByRole('combobox', { hidden: true }));
    fireEvent.click(screen.getByRole('option', { name: 'Bürgerbüro West', hidden: true }));
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith('/bookings/site/locations/loc-2/team/e-9');
    });
    expect(mocks.move).toHaveBeenCalledWith(expect.objectContaining({ locationId: 'loc-2' }));
  });

  it('says why when somebody saved first, and stays', async () => {
    mocks.preview.mockResolvedValue({
      ok: false,
      error: { kind: 'conflict', code: 'booking.resource_stale' },
    });
    inEnglish();

    fireEvent.click(screen.getByRole('button', { name: 'Remove from team' }));
    const question = await screen.findByRole('alertdialog', { hidden: true });
    fireEvent.click(
      within(question).getByRole('button', { name: 'Remove from team', hidden: true }),
    );

    expect(await within(question).findByRole('alert', { hidden: true })).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('cannot move a person when there is no other location', () => {
    inEnglish([]);

    expect(screen.getByRole('button', { name: 'Move to another team' })).toBeDisabled();
  });
});
