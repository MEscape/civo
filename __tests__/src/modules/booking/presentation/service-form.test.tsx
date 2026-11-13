import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ServiceDto, ServiceFormOptionsDto } from '@modules/booking/client';
import { ServiceForm } from '@modules/booking/presentation/components/services/service-form.client';
import type { ServiceStepKey } from '@modules/booking/presentation/forms/service-steps';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import enApp from '@i18n/messages/en.json';

import { expectNoViolations } from '../../../support/a11y';
import {
  COUNTER,
  MEETING_ROOM,
  OPTIONS,
  SHARED_SERVICE,
  serviceDto,
} from '../support/service-dtos';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSearchParams: () => mocks.searchParams,
}));

vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@modules/booking/presentation/actions/create-bookable-service-action', () => ({
  createBookableServiceAction: mocks.create,
}));
vi.mock('@modules/booking/presentation/actions/update-bookable-service-action', () => ({
  updateBookableServiceAction: mocks.update,
}));

function renderForm(
  service: ServiceDto | null,
  part: ServiceStepKey | 'wizard' = 'general',
  step: ServiceStepKey = 'general',
  options: ServiceFormOptionsDto = OPTIONS,
) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ ...enBooking, app: enApp }}
      timeZone="Europe/Berlin"
    >
      <ServiceForm
        websiteId="site"
        locationId="loc-mitte"
        service={service}
        part={part}
        step={step}
        options={options}
      />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams = new URLSearchParams();
});

describe('the steps of a new service', () => {
  it('starts on General, says how far along it is, and offers the next step by name', () => {
    renderForm(null, 'wizard');

    expect(screen.getByRole('heading', { level: 2, name: 'General' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next: Duration & buffers' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('does not go on while the name is missing: it says so at the field and stays', async () => {
    renderForm(null, 'wizard');

    fireEvent.click(screen.getByRole('button', { name: 'Next: Duration & buffers' }));

    expect(await screen.findByText(/Enter a name/i)).toHaveAttribute('role', 'alert');
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name of the service')).toHaveAttribute('aria-invalid', 'true');
  });

  it('goes on to the next step, in the address, once the step is valid', async () => {
    renderForm(null, 'wizard');

    fireEvent.change(screen.getByLabelText('Name of the service'), {
      target: { value: 'Personalausweis beantragen' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next: Duration & buffers' }));

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith(
        '/bookings/site/locations/loc-mitte/services/new?step=timing',
      );
    });
  });

  it('goes back by the address and cancels to the list', () => {
    renderForm(null, 'wizard', 'resources');

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(mocks.push).toHaveBeenCalledWith(
      '/bookings/site/locations/loc-mitte/services/new?step=timing',
    );
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/bookings/site/locations/loc-mitte/services',
    );
  });

  it('takes the manager to the step that holds the problem when the last step is saved with one, and back to the review once it is put right', async () => {
    renderForm(null, 'wizard', 'review');

    fireEvent.click(screen.getByRole('button', { name: 'Save service' }));

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith(
        '/bookings/site/locations/loc-mitte/services/new?step=general&back=review',
      );
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('offers one way on from a step opened from the review: back to it, with no step in between', () => {
    mocks.searchParams.set('back', 'review');
    renderForm(null, 'wizard', 'general');

    expect(screen.getByRole('button', { name: 'Back to review' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('shows what will be saved on the review step, with a way back to every part, and the note about booking', () => {
    renderForm(null, 'wizard', 'review');

    const rows = screen.getByRole('list', { name: 'Parts of the service' });
    expect(within(rows).getAllByRole('button', { name: /^Edit:/ })).toHaveLength(4);
    expect(screen.getByText(/bookable online as soon as it is saved/)).toBeInTheDocument();
  });
});

describe('saving a change to a service', () => {
  it('sends the versions it was read at and what the form holds, and arrives at the service after the server answers', async () => {
    mocks.update.mockResolvedValue({ ok: true, data: { id: 'svc-ausweis' } });
    renderForm(serviceDto());

    fireEvent.change(screen.getByLabelText('Name of the service'), {
      target: { value: 'Personalausweis neu' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith(
        '/bookings/site/locations/loc-mitte/services/svc-ausweis?saved=1',
      );
    });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Personalausweis neu',
        locationId: 'loc-mitte',
        serviceId: 'svc-ausweis',
        expectedVersion: '2027-01-10T11:00:00.000Z',
        expectedSettingVersion: '2027-01-10T11:00:00.000Z',
        acknowledgeShared: false,
        durationMinutes: 20,
        resources: [
          { resourceId: 'res-counter', isRequired: true },
          { resourceId: 'res-room', isRequired: false },
        ],
      }),
    );
  });

  it('says how many locations a change to a shared service reaches, and saves for all of them only after the manager agrees', async () => {
    mocks.update.mockResolvedValue({ ok: true, data: { id: 'svc-ausweis' } });
    renderForm(SHARED_SERVICE);

    fireEvent.change(screen.getByLabelText('Name of the service'), {
      target: { value: 'Geteilt und geändert' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'This change applies at 2 locations',
    });
    expect(within(dialog).getByText(/Bürgerbüro Süd/)).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save for all locations' }));

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({ acknowledgeShared: true }),
      );
    });
  });

  it('does not ask when only this location’s own part changed', async () => {
    mocks.update.mockResolvedValue({ ok: true, data: { id: 'svc-ausweis' } });
    renderForm(SHARED_SERVICE);

    fireEvent.click(screen.getByRole('switch', { name: 'Bookable online' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({ acknowledgeShared: false, isOnlineBookable: false }),
      );
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the input and says somebody else saved first when the version has moved on', async () => {
    mocks.update.mockResolvedValue({
      ok: false,
      error: { code: 'booking.service_stale', message: 'stale' },
    });
    renderForm(serviceDto());

    fireEvent.change(screen.getByLabelText('Name of the service'), {
      target: { value: 'Meine Eingabe' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('The service has changed in the meantime')).toBeInTheDocument();
    expect(screen.getByLabelText('Name of the service')).toHaveValue('Meine Eingabe');
    expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('puts the server’s refusal of a field on that field, and shows no success', async () => {
    mocks.update.mockResolvedValue({
      ok: false,
      error: {
        code: 'booking.validation_failed',
        message: 'invalid',
        fieldErrors: { name: ['booking.validation.name_invalid'] },
      },
    });
    renderForm(serviceDto());

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/Enter a name/i)).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('sends one request however often the button is pressed while it waits', async () => {
    let finish: (value: unknown) => void = () => undefined;
    mocks.update.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderForm(serviceDto());
    const button = screen.getByRole('button', { name: 'Save' });

    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Saving …' })).toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Saving …' }));
    finish({ ok: true, data: { id: 'svc-ausweis' } });

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledTimes(1);
    });
  });
});

describe('what each part of the form shows', () => {
  it('General: says an inactive existing service keeps its bookings, and keeps the internal note out of sight until asked for', () => {
    renderForm(serviceDto({ isActive: false }));

    expect(screen.getByText(/Existing appointments stay valid/)).toBeInTheDocument();
    const advanced = screen.getByText('Advanced').closest('details');
    expect(advanced).not.toHaveAttribute('open');
    expect(within(advanced as HTMLElement).getByLabelText('Internal note')).toHaveValue(
      'nur intern',
    );
  });

  it('Rules: asks the booking deadline once, says who may change and that preferences only sort', () => {
    renderForm(serviceDto(), 'rules');

    expect(screen.getAllByLabelText('Booking deadline')).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: 'Citizen' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Employee' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Manager' })).toBeChecked();
    expect(screen.getByText('Preferences: only an order')).toBeInTheDocument();
    expect(screen.getByText(/Nobody is excluded by preferences/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Who takes the appointment?' })).toHaveTextContent(
      'Ausweise',
    );
  });

  it('Rules: refuses a service nobody may cancel, saying who has to be chosen', async () => {
    renderForm(serviceDto(), 'rules');

    for (const name of ['Citizen', 'Employee', 'Manager']) {
      fireEvent.click(screen.getByRole('checkbox', { name }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/Choose at least one person/)).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('Resources: names each resource and says how many services use it, without a way to make one mid-form', () => {
    renderForm(serviceDto(), 'resources');

    const list = screen.getByRole('list', { name: 'Resources of the service' });
    expect(within(list).getByText('Schalter')).toBeInTheDocument();
    expect(within(list).getByText('Besprechungsraum')).toBeInTheDocument();
    expect(screen.getByText('Schalter is already used by 6 services.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Create a new resource' })).not.toBeInTheDocument();
  });

  it('Resources: with none at the location, a single part leads to making one, and the wizard has no such step', () => {
    const none = { ...OPTIONS, resources: [] };
    renderForm(serviceDto({ resources: [] }), 'resources', 'general', none);
    expect(
      screen.getByRole('link', { name: 'Create a new resource' }).getAttribute('href'),
    ).toMatch(/\/resources\/new$/);
  });

  it('Wizard: skips the resources step where the location has no resources', () => {
    renderForm(null, 'wizard', 'timing', { ...OPTIONS, resources: [] });

    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next: Rules & permissions' })).toBeInTheDocument();
  });

  it('General: a category is chosen from a list or added from what is typed, and a category-less location says how to add the first', () => {
    renderForm(null, 'wizard', 'general', { ...OPTIONS, categories: [] });

    const field = screen.getByRole('combobox', { name: 'Category' });
    fireEvent.focus(field);
    expect(screen.getByText(/No category yet/)).toBeInTheDocument();
    fireEvent.change(field, { target: { value: 'Ausweise' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Add “Ausweise”' }));
    expect(field).toHaveValue('Ausweise');
  });

  it('General: documents to bring are added inside the field with Enter and taken away again', () => {
    renderForm(null, 'wizard', 'general');

    const field = screen.getByRole('combobox', { name: 'Documents to bring' });
    fireEvent.change(field, { target: { value: 'ID card' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(screen.getByText('ID card')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove ID card' }));
    expect(screen.queryByText('ID card')).not.toBeInTheDocument();
  });

  it('Resources: every resource of the location is a row with one choice, so nothing is added or taken away', () => {
    renderForm(serviceDto(), 'resources');

    const meetingRoom = screen.getByRole('radiogroup', {
      name: 'Besprechungsraum: what the service needs',
    });
    fireEvent.click(within(meetingRoom).getByRole('radio', { name: 'Needed' }));
    expect(within(meetingRoom).getByRole('radio', { name: 'Needed' })).toBeChecked();

    fireEvent.click(within(meetingRoom).getByRole('radio', { name: 'If free' }));
    expect(within(meetingRoom).getByRole('radio', { name: 'If free' })).toBeChecked();

    fireEvent.click(within(meetingRoom).getByRole('radio', { name: 'Not needed' }));
    expect(within(meetingRoom).getByRole('radio', { name: 'Not needed' })).toBeChecked();
    expect(screen.getByText('Besprechungsraum', { selector: 'p' })).toBeInTheDocument();
  });

  it('Resources: warns, without blocking, that a required resource is not active', () => {
    const inactive = serviceDto({
      resources: [
        {
          id: 'res-counter',
          name: 'Schalter',
          type: 'service-desk',
          capacity: 1,
          isActive: false,
          setupMinutes: 0,
          teardownMinutes: 0,
          usedByServices: 0,
          isRequired: true,
        },
      ],
    });
    renderForm(inactive, 'resources', 'resources', {
      ...OPTIONS,
      resources: [{ ...COUNTER, isActive: false }, MEETING_ROOM],
    });

    expect(screen.getByText(/Schalter is not active at the moment/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});

describe('accessibility of each part', () => {
  it.each(['general', 'timing', 'resources', 'rules', 'review'] as const)(
    'has no violations axe can find on the %s step',
    async (part) => {
      const { container } = renderForm(serviceDto(), 'wizard', part);

      await expectNoViolations(container);
    },
  );
});
