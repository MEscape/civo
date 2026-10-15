import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { previewServiceFeasibilityAction } from '@modules/booking/presentation/actions/preview-service-feasibility-action';
import { saveServiceAction } from '@modules/booking/presentation/actions/save-service-action';
import type { ServiceFeasibilityDto } from '@modules/booking/presentation/dto/setup-dto';

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

const save = vi.mocked(saveServiceAction);
const preview = vi.mocked(previewServiceFeasibilityAction);

const OPTIONS = {
  locations: [
    { id: 'loc-berlin', name: 'Town hall', timeZone: 'Europe/Berlin' },
    { id: 'loc-annex', name: 'Annex', timeZone: 'Europe/Berlin' },
  ],
  resources: [
    { id: 'r-desk', name: 'Desk 1', type: 'service-desk', locationId: null, skills: ['passport'] },
    {
      id: 'r-room',
      name: 'Meeting room',
      type: 'room',
      locationId: null,
      skills: ['projector', 'wheelchair'],
    },
  ],
  services: [],
  skills: ['passport', 'projector', 'wheelchair'],
  categories: ['citizen-services', 'sports'],
} as const;

const BLOCKED: ServiceFeasibilityDto = {
  canBePublished: false,
  locations: [
    {
      locationId: 'loc-berlin',
      locationName: 'Town hall',
      readiness: 'blocked',
      block: 'not-enough-resources',
      blockedRequirementIndex: 0,
      largestGroup: 0,
      coverage: [
        {
          requirementIndex: 0,
          resourceType: 'room',
          needed: 1,
          eligibleCount: 0,
          eligible: [],
          funnel: { ofType: 0, withSkills: 0, atLocation: 0, inPool: 0 },
          awaitingEmployees: 0,
        },
      ],
    },
  ],
};

const READY: ServiceFeasibilityDto = {
  canBePublished: true,
  locations: [
    {
      locationId: 'loc-berlin',
      locationName: 'Town hall',
      readiness: 'ready',
      block: null,
      blockedRequirementIndex: null,
      largestGroup: 4,
      coverage: [
        {
          requirementIndex: 0,
          resourceType: 'service-desk',
          needed: 1,
          eligibleCount: 1,
          eligible: [{ id: 'r-desk', name: 'Desk 1' }],
          funnel: { ofType: 1, withSkills: 1, atLocation: 1, inPool: 1 },
          awaitingEmployees: 0,
        },
      ],
    },
  ],
};

function renderForm(items = [serviceDto()]) {
  return renderBooking(<ServicesAtLocation services={items} options={OPTIONS} canConfigure />);
}

function checkPanel() {
  return screen.getByRole('region', { name: 'Is this service bookable?' });
}

async function openNew(user: ReturnType<typeof setup>) {
  renderForm([]);
  await user.click(await screen.findByRole('button', { name: 'New service' }));
}

beforeEach(() => {
  save.mockReset();
  save.mockResolvedValue({ ok: true, data: serviceDto() });
  preview.mockReset();
  preview.mockResolvedValue({ ok: true, data: READY });
});

describe('choosing the category', () => {
  it('finds an existing category by typing part of it, and stores its key', async () => {
    const user = setup();
    await openNew(user);
    await user.type(screen.getByLabelText('Name'), 'Passport');
    const category = screen.getByRole('combobox', { name: 'Category' });
    fireEvent.focus(category);
    fireEvent.change(category, { target: { value: 'citizen' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: 'citizen services' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(save).toHaveBeenCalled();
    });
    expect(save.mock.calls[0]?.[0]).toMatchObject({ category: 'citizen-services' });
  });

  it('adds a new category in the shape the domain stores, without duplicating an old one', async () => {
    const user = setup();
    await openNew(user);
    await user.type(screen.getByLabelText('Name'), 'Passport');
    const category = screen.getByRole('combobox', { name: 'Category' });
    fireEvent.focus(category);
    fireEvent.change(category, { target: { value: 'Bürger Dienste' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Add “buerger-dienste”' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(save).toHaveBeenCalled();
    });
    expect(save.mock.calls[0]?.[0]).toMatchObject({ category: 'buerger-dienste' });
  });

  it('offers no "add" row for a category that already exists', async () => {
    const user = setup();
    await openNew(user);
    const category = screen.getByRole('combobox', { name: 'Category' });
    fireEvent.focus(category);
    fireEvent.change(category, { target: { value: 'sports' } });

    expect(screen.getByRole('option', { name: 'sports' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^Add/ })).toBeNull();
  });
});

describe('where the service is offered', () => {
  it('is made at the location it is made in, with no choice about where', async () => {
    const user = setup();
    await openNew(user);
    await user.type(screen.getByLabelText('Name'), 'Passport');

    expect(screen.queryByRole('combobox', { name: 'Also offer at' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(save).toHaveBeenCalled();
    });
    expect(save.mock.calls[0]?.[0]).toMatchObject({ locationIds: ['loc-berlin'] });
  });

  it('keeps the other locations of a service that is changed here', async () => {
    const user = setup();
    renderForm([serviceDto({ locationIds: ['loc-annex', 'loc-berlin'] })]);
    await user.click(await screen.findByRole('button', { name: /Edit Passport/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(save).toHaveBeenCalled();
    });
    expect(save.mock.calls[0]?.[0]).toMatchObject({ locationIds: ['loc-annex', 'loc-berlin'] });
  });
});

describe('what the form says about the place', () => {
  it('names the location the service is made at', async () => {
    const user = setup();
    await openNew(user);

    expect(screen.getByText('Location: Town hall')).toBeInTheDocument();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('warns that a change reaches the other locations that offer the service', async () => {
    const user = setup();
    renderForm([serviceDto({ locationIds: ['loc-annex', 'loc-berlin'] })]);
    await user.click(await screen.findByRole('button', { name: /Edit Passport/ }));

    expect(screen.getByRole('note')).toHaveTextContent(
      'This service is also offered at 1 other location. Changes apply there as well.',
    );
  });
});

describe('what a service can require', () => {
  const HINT = /Rooms and equipment are set up in the “Rooms and equipment” section/;

  it('points to the rooms section while there is nothing but employees to require', async () => {
    const user = setup();
    renderBooking(
      <ServicesAtLocation services={[]} options={{ ...OPTIONS, resources: [] }} canConfigure />,
    );
    await user.click(await screen.findByRole('button', { name: 'New service' }));

    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it('says nothing of the kind once rooms or equipment exist', async () => {
    const user = setup();
    await openNew(user);

    expect(screen.queryByText(HINT)).toBeNull();
  });
});

describe('the start-time spacing', () => {
  it('shows what visitors will see for the chosen spacing', async () => {
    const user = setup();
    await openNew(user);

    expect(
      screen.getByText(/Visitors see, for example: 08:00, 08:15, 08:30, 08:45/),
    ).toBeInTheDocument();
  });
});

describe('the required capabilities', () => {
  it('offers only what resources of the chosen type have', async () => {
    const user = setup();
    renderForm();
    await user.click(await screen.findByRole('button', { name: /Edit Passport/ }));

    expect(screen.getByRole('button', { name: 'Remove passport' })).toBeInTheDocument();
    const skills = screen.getByRole('combobox', { name: 'Required capabilities' });
    fireEvent.focus(skills);
    // The desk has "passport"; the room's capabilities do not belong to the desk type.
    expect(screen.queryByRole('option', { name: 'projector' })).toBeNull();
    expect(
      screen.getByText(
        'No capabilities exist for this type yet. They are created on the resource.',
      ),
    ).toBeInTheDocument();
  });
});

describe('the bookability check', () => {
  it('explains why nothing can serve the service, in terms of what is missing', async () => {
    preview.mockResolvedValue({ ok: true, data: BLOCKED });
    const user = setup();
    await openNew(user);

    expect(
      await screen.findByText('There is no active resource of type Room.', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(within(checkPanel()).getByText('Not bookable')).toBeInTheDocument();
    expect(screen.getByText(/save it as a draft|saved as a draft/i)).toBeInTheDocument();
  });

  it('names the resources that can serve it and how large a group they fit', async () => {
    const user = setup();
    await openNew(user);

    expect(await screen.findByText(/Desk 1/, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(within(checkPanel()).getByText('Bookable')).toBeInTheDocument();
    expect(screen.getByText('Largest possible group: 4')).toBeInTheDocument();
  });

  it('asks the server once the form is still, and sends only what the rules need', async () => {
    const user = setup();
    await openNew(user);
    await within(checkPanel()).findByText('Bookable', {}, { timeout: 3000 });

    expect(preview).toHaveBeenCalledTimes(1);
    expect(preview.mock.calls[0]?.[0]).toMatchObject({
      websiteId: 'site-1',
      locationIds: ['loc-berlin'],
      participantsPerBooking: 1,
    });
    expect(preview.mock.calls[0]?.[0]).not.toHaveProperty('name');
  });

  it('says the check is unavailable when the server cannot answer, and still allows saving', async () => {
    preview.mockResolvedValue({ ok: false, error: { code: 'x', message: 'x' } });
    const user = setup();
    await openNew(user);

    expect(
      await screen.findByText(/The check is not available right now/, {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});
