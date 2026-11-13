import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TeamSetUpButton } from '@modules/booking/presentation/components/team/team-set-up-button.client';
import enBooking from '@modules/booking/presentation/i18n/en.json';

vi.mock('@modules/booking/presentation/hooks/use-booking-website', () => ({
  useBookingWebsite: () => 'site-1',
  BookingWebsiteProvider: ({ children }: { children: unknown }) => children,
}));

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), setUp: vi.fn() }));

vi.mock('@i18n', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@modules/booking/presentation/actions/set-up-team-member-action', () => ({
  setUpTeamMemberAction: mocks.setUp,
}));
vi.mock('@modules/booking/presentation/actions/acknowledge-manager-change-action', () => ({
  acknowledgeManagerChangeAction: vi.fn(),
}));
// The Radix select needs a real pointer; a native one drives the same value and handler.
vi.mock('@components/shared/select-field', () => ({
  SelectField: ({
    id,
    label,
    options,
    placeholder,
    value,
    onValueChange,
    disabled,
  }: {
    id: string;
    label: string;
    options: ReadonlyArray<{ value: string; label: string }>;
    placeholder: string;
    value: string;
    onValueChange: (next: string) => void;
    disabled: boolean;
  }) => (
    <>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onValueChange(event.target.value);
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  ),
}));

const LOCATION = { id: 'loc-1', name: 'Bürgerbüro Mitte' };
const CANDIDATES = [
  { actorId: 'a-1', name: 'Anna Müller' },
  { actorId: 'a-2', name: 'Jan Koch' },
];

const renderButton = () =>
  render(
    <NextIntlClientProvider locale="en" messages={enBooking} timeZone="Europe/Berlin">
      <TeamSetUpButton websiteId="site" location={LOCATION} candidates={CANDIDATES} />
    </NextIntlClientProvider>,
  );

const openDialog = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Add employee' }));
  return screen.getByRole('dialog', { name: 'Add an employee', hidden: true });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('adding an employee to a location', () => {
  it('asks who in a dialog that names the location, and cannot be confirmed before someone is chosen', () => {
    renderButton();
    const dialog = openDialog();

    expect(dialog).toHaveTextContent('Bürgerbüro Mitte');
    expect(screen.getByRole('button', { name: 'Set up', hidden: true })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Anna Müller', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Jan Koch', hidden: true })).toBeInTheDocument();
  });

  it('gives the chosen member their calendar and opens it to be filled in', async () => {
    mocks.setUp.mockResolvedValue({ ok: true, data: { id: 'e-9' } });
    renderButton();
    openDialog();

    fireEvent.change(screen.getByLabelText('Member', { selector: 'select' }), {
      target: { value: 'a-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set up', hidden: true }));

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith('/bookings/site/locations/loc-1/team/e-9');
    });
    expect(mocks.setUp).toHaveBeenCalledWith({
      websiteId: 'site-1',
      actorId: 'a-2',
      locationId: 'loc-1',
    });
  });

  it('says why when the server refuses, stays on the dialog, and does not leave the page', async () => {
    mocks.setUp.mockResolvedValue({
      ok: false,
      error: { kind: 'conflict', code: 'booking.team_member_exists' },
    });
    renderButton();
    openDialog();

    fireEvent.change(screen.getByLabelText('Member', { selector: 'select' }), {
      target: { value: 'a-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set up', hidden: true }));

    expect(await screen.findByRole('alert', { hidden: true })).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Set up', hidden: true })).toBeEnabled();
    });
  });

  it('closes with Cancel and asks nothing of the server', () => {
    renderButton();
    openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel', hidden: true }));

    expect(mocks.setUp).not.toHaveBeenCalled();
  });
});
