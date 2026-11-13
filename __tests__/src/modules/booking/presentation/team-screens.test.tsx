import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TeamMemberForm } from '@modules/booking/presentation/components/team/team-member-form.client';
import type { TeamMemberDto } from '@modules/booking/presentation/dto/team-dto';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { expectNoViolations } from '../../../support/a11y';
import { officeWeek } from '../support/location-inputs';

vi.mock('@modules/booking/presentation/hooks/use-booking-website', () => ({
  useBookingWebsite: () => 'site-1',
  BookingWebsiteProvider: ({ children }: { children: unknown }) => children,
}));

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  update: vi.fn(),
  previewMember: vi.fn(),
  saveOwn: vi.fn(),
  previewOwn: vi.fn(),
}));

vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@modules/booking/presentation/actions/update-team-member-action', () => ({
  updateTeamMemberAction: mocks.update,
}));
vi.mock('@modules/booking/presentation/actions/preview-team-member-change-action', () => ({
  previewTeamMemberChangeAction: mocks.previewMember,
}));
vi.mock('@modules/booking/presentation/actions/save-own-profile-action', () => ({
  saveOwnProfileAction: mocks.saveOwn,
}));
vi.mock('@modules/booking/presentation/actions/preview-own-profile-change-action', () => ({
  previewOwnProfileChangeAction: mocks.previewOwn,
}));
vi.mock('@modules/booking/presentation/actions/set-up-team-member-action', () => ({
  setUpTeamMemberAction: vi.fn(),
}));

const MEMBER: TeamMemberDto = {
  id: 'e-1',
  name: 'Anna Müller',
  weekly: officeWeek(),
  absences: [{ from: '2027-02-01', to: '2027-02-05' }],
  coverage: [],
  qualifications: ['ausweise'],
  websiteId: 'site',
  location: { id: 'loc-1', name: 'Bürgerbüro Mitte' },
  coverageChoices: [{ id: 'loc-2', name: 'Bürgerbüro West' }],
  locationWeekly: officeWeek(),
  knownQualifications: ['ausweise', 'meldewesen'],
  version: '2027-01-10T08:30:00.000Z',
};

const inEnglish = (node: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={enBooking} timeZone="Europe/Berlin">
      {node}
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the calendar form', () => {
  it('lets a manager grant qualifications', async () => {
    const { container } = inEnglish(
      <TeamMemberForm mode="manager" member={MEMBER} savedHref="/team" cancelHref="/team" />,
    );

    expect(screen.getByRole('combobox', { name: 'Qualifications' })).toBeInTheDocument();
    // The absences are a table with a dialog to add one, like the exceptions of a location.
    expect(screen.getByRole('button', { name: /^Remove: / })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add absence' })).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it('starts afresh from the calendar when it has moved on, so saving never undoes what somebody else saved', () => {
    const view = (member: TeamMemberDto) => (
      <NextIntlClientProvider locale="en" messages={enBooking} timeZone="Europe/Berlin">
        <TeamMemberForm mode="manager" member={member} savedHref="/team" cancelHref="/team" />
      </NextIntlClientProvider>
    );
    const monday = (start: string) =>
      officeWeek({ 0: { intervals: [{ start, end: '16:00' }], breaks: [] } });
    const { rerender } = render(view({ ...MEMBER, weekly: monday('08:00') }));
    expect(screen.getAllByText(/08:00–16:00/).length).toBeGreaterThan(0);

    // The employee saved 08:30 meanwhile: the page is read again and arrives with the new version.
    rerender(view({ ...MEMBER, weekly: monday('08:30'), version: '2027-01-10T09:00:00.000Z' }));

    expect(screen.getAllByText(/08:30–16:00/).length).toBeGreaterThan(0);
  });

  it('speaks to the employee as "you" and to a manager about "the person", and points the employee to the preferences', () => {
    const view = inEnglish(
      <TeamMemberForm
        mode="own"
        member={MEMBER}
        savedHref="/me"
        cancelHref="/me"
        preferencesHref="/me/preferences"
      />,
    );
    expect(screen.getAllByText(/On these days you do not work/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'My preferences' })).toHaveAttribute(
      'href',
      '/me/preferences',
    );
    view.unmount();

    inEnglish(<TeamMemberForm mode="manager" member={MEMBER} savedHref="/t" cancelHref="/t" />);
    expect(screen.getAllByText(/On these days the person does not work/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'My preferences' })).toBeNull();
  });

  it('shows the employee no qualifications to edit, and saves their own week without naming a calendar', async () => {
    mocks.saveOwn.mockResolvedValue({ ok: true, data: MEMBER });
    inEnglish(<TeamMemberForm mode="own" member={MEMBER} savedHref="/me" cancelHref="/me" />);

    expect(screen.queryByRole('combobox', { name: 'Qualifications' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith('/me');
    });
    expect(mocks.saveOwn).toHaveBeenCalledWith({
      websiteId: MEMBER.websiteId,
      openingHours: expect.objectContaining({
        exceptions: [{ kind: 'closed', from: '2027-02-01', to: '2027-02-05' }],
      }),
      expectedVersion: MEMBER.version,
      acknowledgeImpact: false,
    });
    expect(mocks.previewOwn).not.toHaveBeenCalled();
  });

  it('asks which bookings a removed working day leaves without the employee before saving', async () => {
    mocks.previewMember.mockResolvedValue({
      ok: true,
      data: {
        isTruncated: false,
        affected: [
          {
            bookingId: 'b-1',
            serviceId: 's-1',
            timeZone: 'Europe/Berlin',
            start: '2027-01-11T09:00:00+01:00',
            end: '2027-01-11T09:30:00+01:00',
            reason: 'resource-unavailable',
          },
        ],
      },
    });
    mocks.update.mockResolvedValue({ ok: true, data: MEMBER });
    inEnglish(
      <TeamMemberForm mode="manager" member={MEMBER} savedHref="/team" cancelHref="/team" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Remove: / }));
    const question = screen.getByRole('alertdialog', { name: 'Remove absence?', hidden: true });
    fireEvent.click(within(question).getByRole('button', { name: 'Remove', hidden: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('open again');
    expect(mocks.update).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: 'Save anyway', hidden: true });
    await waitFor(() => {
      expect(confirm).toBeEnabled();
    });
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 'e-1', acknowledgeImpact: true }),
      );
    });
  });
});
