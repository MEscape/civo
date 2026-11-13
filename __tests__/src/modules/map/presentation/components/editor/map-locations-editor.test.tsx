import { zodResolver } from '@hookform/resolvers/zod';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { MapLocationsEditor } from '@modules/map/presentation/components/editor/map-locations-editor';
import en from '@modules/map/presentation/i18n/en.json';
import { savedMapDraftSchema } from '@modules/map/presentation/schemas/saved-map-schema';
import type { MapEditorValues } from '@modules/map/presentation/schemas/saved-map-schema';

import { Button } from '@components/ui/button';

import { mapDraft } from '../../../support/map-fakes';

const HITS = [
  { id: 'h1', label: 'Rathaus, Marktplatz 1, Musterstadt', lng: 10, lat: 51 },
  { id: 'h2', label: 'Bibliothek, Schulweg 2, Musterstadt', lng: 12, lat: 53 },
];
vi.mock('@hooks/use-address-search', () => ({
  useAddressSearch: () => ({ hits: HITS, isSearching: false }),
}));

const HALL = { id: 'hall-original', label: 'Town hall', longitude: 10, latitude: 51 };

const messages = {
  ...en,
  app: { autocomplete: { searching: 'Searching' } },
};

function LocationsForm({
  locations = [HALL],
  accessToken = 'token',
  onSave,
}: {
  readonly locations?: MapEditorValues['settings']['locations'];
  readonly accessToken?: string | null;
  readonly onSave: (values: MapEditorValues) => void;
}) {
  const draft = savedMapDraftSchema.parse(mapDraft());
  const form = useForm<MapEditorValues>({
    resolver: zodResolver(savedMapDraftSchema),
    defaultValues: { ...draft, settings: { ...draft.settings, layers: [], locations } },
  });
  return (
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <form noValidate onSubmit={form.handleSubmit(onSave)}>
        <MapLocationsEditor
          form={form}
          errorText={(message) => (message === undefined ? undefined : 'Check this value.')}
          accessToken={accessToken}
        />
        <Button type="submit">Save</Button>
      </form>
    </NextIntlClientProvider>
  );
}

function pick(label: string) {
  const search = screen.getByRole('combobox', { name: 'Add a location by address' });
  fireEvent.change(search, { target: { value: 'Musterstadt' } });
  fireEvent.mouseDown(screen.getByRole('option', { name: label }));
}

async function saveOnce(onSave: ReturnType<typeof vi.fn>) {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => {
    expect(onSave).toHaveBeenCalled();
  });
  return onSave.mock.calls.at(-1)?.[0] as MapEditorValues;
}

describe('MapLocationsEditor', () => {
  it('adds a location from a picked address, named after the place, and fits the start area', async () => {
    const onSave = vi.fn();
    render(<LocationsForm onSave={onSave} />);

    pick(HITS[1]?.label ?? '');

    const added = screen.getByRole('group', { name: 'Location 2' });
    expect(within(added).getByLabelText('Location name')).toHaveValue('Bibliothek');
    expect(within(added).queryByLabelText('Longitude')).not.toBeInTheDocument();
    expect(within(added).getByText('Latitude 53, longitude 12')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Add a location by address' })).toHaveValue('');

    const saved = await saveOnce(onSave);
    expect(saved.settings.locations?.map((location) => location.label)).toEqual([
      'Town hall',
      'Bibliothek',
    ]);
    expect(saved.settings.locations?.[0]?.id).toBe(HALL.id);
    expect(new Set(saved.settings.locations?.map((location) => location.id)).size).toBe(2);
    expect(saved.settings.initialBounds).toEqual([9.8, 50.8, 12.2, 53.2]);
  });

  it('removes the chosen location and keeps the others with their ids', async () => {
    const onSave = vi.fn();
    render(<LocationsForm onSave={onSave} />);
    pick(HITS[1]?.label ?? '');

    fireEvent.click(screen.getByRole('button', { name: 'Remove location 1' }));

    expect(screen.getAllByRole('group', { name: /^Location \d/ })).toHaveLength(1);
    const saved = await saveOnce(onSave);
    expect(saved.settings.locations?.map((location) => location.label)).toEqual(['Bibliothek']);
  });

  it('without an address search, explains it and lets coordinates be typed', async () => {
    const onSave = vi.fn();
    render(<LocationsForm accessToken={null} locations={[]} onSave={onSave} />);

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Address search is not set up');
    fireEvent.click(screen.getByRole('button', { name: 'Add location manually' }));
    fireEvent.change(screen.getByLabelText('Location name'), { target: { value: 'Hall' } });
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '181' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Check this value.');
    expect(screen.getByLabelText('Longitude')).toHaveAttribute('aria-invalid', 'true');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps an optional description and link for a location, and refuses an unsafe link', async () => {
    const onSave = vi.fn();
    render(<LocationsForm onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Opening hours at the desk.' },
    });
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Enter a web address/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Link'), { target: { value: '/contact' } });
    const saved = await saveOnce(onSave);
    expect(saved.settings.locations?.[0]).toMatchObject({
      description: 'Opening hours at the desk.',
      href: '/contact',
    });
  });
});
