import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { previewServiceFeasibilityAction } from '@modules/booking/presentation/actions/preview-service-feasibility-action';
import {
  deadlineChoices,
  deadlinePartsOf,
  policyReachOf,
} from '@modules/booking/presentation/drafts/policy-deadlines';

import { serviceDto } from './fixtures';
import { renderBooking, setup } from './ui-support';
import { ServicesAtLocation } from './workspace-support';

vi.mock('@i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock('@modules/booking/presentation/actions/save-service-action', () => ({
  saveServiceAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/preview-service-feasibility-action', () => ({
  previewServiceFeasibilityAction: vi.fn(),
}));

const OPTIONS = {
  locations: [{ id: 'loc-berlin', name: 'Town hall', timeZone: 'Europe/Berlin' }],
  resources: [],
  services: [],
  skills: [],
  categories: [],
} as const;

beforeEach(() => {
  vi.mocked(previewServiceFeasibilityAction).mockResolvedValue({
    ok: true,
    data: { canBePublished: true, locations: [] },
  });
});

describe('deadlines in words', () => {
  it('reads the largest unit that divides the minutes evenly', () => {
    expect(deadlinePartsOf(1440)).toEqual({ amount: 1, unit: 'day' });
    expect(deadlinePartsOf(10_080)).toEqual({ amount: 1, unit: 'week' });
    expect(deadlinePartsOf(120)).toEqual({ amount: 2, unit: 'hour' });
    expect(deadlinePartsOf(90)).toEqual({ amount: 90, unit: 'minute' });
  });

  it('keeps a saved deadline that is not a standard choice', () => {
    expect(deadlineChoices(90)).toContain(90);
    expect(deadlineChoices(1440).filter((minutes) => minutes === 1440)).toHaveLength(1);
  });

  it('says who can change a booking at all', () => {
    expect(policyReachOf({ isAllowed: false, allowedActors: ['customer'] })).toBe('nobody');
    expect(policyReachOf({ isAllowed: true, allowedActors: [] })).toBe('nobody');
    expect(policyReachOf({ isAllowed: true, allowedActors: ['staff'] })).toBe('staffOnly');
    expect(policyReachOf({ isAllowed: true, allowedActors: ['customer'] })).toBe('customersOnly');
    expect(policyReachOf({ isAllowed: true, allowedActors: ['customer', 'staff'] })).toBe(
      'customersAndStaff',
    );
  });
});

describe('the cancellation and moving rules in the service form', () => {
  async function openPassport() {
    const user = setup();
    renderBooking(<ServicesAtLocation services={[serviceDto()]} options={OPTIONS} canConfigure />);
    await user.click(await screen.findByRole('button', { name: /Edit Passport/ }));
    return user;
  }

  it('states the rule as a sentence, for each of cancelling and moving', async () => {
    await openPassport();

    expect(
      screen.getByText(
        'Customers can cancel themselves until 1 day before the start. After that only staff can, and they can cancel at any time.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Customers can move themselves until 1 day before the start/),
    ).toBeInTheDocument();
  });

  it('drops the deadline and says so when customers may not change a booking themselves', async () => {
    const user = await openPassport();
    const cancellation = screen.getByRole('group', { name: 'Cancellation' });

    await user.click(within(cancellation).getByRole('checkbox', { name: 'Customer' }));

    expect(
      within(cancellation).queryByRole('combobox', { name: /Customers may until/ }),
    ).toBeNull();
    expect(
      within(cancellation).getByText('Only staff can cancel. Customers have to contact you.'),
    ).toBeInTheDocument();
  });

  it('offers the deadline in words, never as raw minutes', async () => {
    await openPassport();
    const cancellation = screen.getByRole('group', { name: 'Cancellation' });

    expect(
      within(cancellation).getByRole('combobox', { name: /Customers may until/ }),
    ).toHaveTextContent('1 day before the start');
  });
});

describe('the visitor information preview', () => {
  it('shows the questions in order with what is required, and the documents and note', async () => {
    const user = setup();
    renderBooking(
      <ServicesAtLocation
        services={[serviceDto({ requiredDocuments: ['Photo ID'], instructions: 'Arrive early.' })]}
        options={OPTIONS}
        canConfigure
      />,
    );
    await user.click(await screen.findByRole('button', { name: /Edit Passport/ }));
    const preview = screen.getByRole('region', { name: 'How visitors see it' });

    const rows = within(preview).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent(/First name.*required/);
    expect(within(preview).getByText('Photo ID')).toBeInTheDocument();
    expect(within(preview).getByText(/Arrive early\./)).toBeInTheDocument();
  });

  it('follows the editor as they change it', async () => {
    const user = setup();
    renderBooking(<ServicesAtLocation services={[serviceDto()]} options={OPTIONS} canConfigure />);
    await user.click(await screen.findByRole('button', { name: /Edit Passport/ }));
    const preview = screen.getByRole('region', { name: 'How visitors see it' });
    expect(within(preview).queryByText('Photo ID')).toBeNull();

    fireEvent.change(screen.getByLabelText('Documents to bring (one per line)'), {
      target: { value: 'Photo ID\nOld passport' },
    });

    expect(within(preview).getByText('Old passport')).toBeInTheDocument();
  });
});
