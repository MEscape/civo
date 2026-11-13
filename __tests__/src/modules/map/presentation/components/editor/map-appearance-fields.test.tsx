import { zodResolver } from '@hookform/resolvers/zod';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { FieldProfile } from '@modules/map/application/contracts/map-constraints';
import { MapAppearanceFields } from '@modules/map/presentation/components/editor/map-appearance-fields';
import en from '@modules/map/presentation/i18n/en.json';
import { savedMapDraftSchema } from '@modules/map/presentation/schemas/saved-map-schema';
import type { MapEditorValues } from '@modules/map/presentation/schemas/saved-map-schema';

import { mapDraft } from '../../../support/map-fakes';

const ATTRIBUTES: readonly FieldProfile[] = [
  { key: 'category', type: 'text', distinct: [{ value: 'park', count: 2 }] },
  { key: 'visitors', type: 'number', distinct: null, min: 1, max: 9 },
  { key: 'notes', type: 'text', distinct: null },
];

function Fields({
  layers,
  pointStyle = 'markers',
  hasStreetTiles = false,
  onValues,
}: {
  readonly layers: MapEditorValues['settings']['layers'];
  readonly pointStyle?: MapEditorValues['settings']['pointStyle'];
  readonly hasStreetTiles?: boolean;
  readonly onValues?: (values: MapEditorValues) => void;
}) {
  const draft = savedMapDraftSchema.parse(mapDraft());
  const form = useForm<MapEditorValues>({
    resolver: zodResolver(savedMapDraftSchema),
    defaultValues: {
      ...draft,
      settings: {
        ...draft.settings,
        layers,
        locations:
          layers.length === 0 ? [{ id: 'a', label: 'Hall', longitude: 10, latitude: 51 }] : [],
        pointStyle,
      },
    },
  });
  return (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <form onSubmit={form.handleSubmit((values) => onValues?.(values))}>
        <MapAppearanceFields
          form={form}
          errorText={() => undefined}
          attributes={ATTRIBUTES}
          hasStreetTiles={hasStreetTiles}
        />
        <button type="submit">Save</button>
      </form>
    </NextIntlClientProvider>
  );
}

describe('MapAppearanceFields', () => {
  it('names the installation-wide background and what point styles do on it', () => {
    const { unmount } = render(<Fields layers={[]} />);
    expect(screen.getByText('Map background')).toBeInTheDocument();
    expect(screen.getByText('Vector map (no third parties)')).toBeInTheDocument();
    expect(screen.getByText(/every location appears as the same dot/)).toBeInTheDocument();
    expect(screen.getByText(/NEXT_PUBLIC_EXTERNAL_MAPS_ALLOWED=true/)).toBeInTheDocument();
    unmount();

    render(<Fields layers={[]} hasStreetTiles />);
    expect(screen.getByText('Street map (Mapbox)')).toBeInTheDocument();
    expect(screen.getByText(/visitors request data from Mapbox/)).toBeInTheDocument();
  });

  it('offers only what a map of its own locations can use, and hides the data options', async () => {
    let saved: MapEditorValues | undefined;
    render(
      <Fields
        layers={[]}
        pointStyle="heatmap"
        onValues={(values) => {
          saved = values;
        }}
      />,
    );

    expect(screen.queryByText('More options')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Color by attribute')).not.toBeInTheDocument();
    // A style that needs data falls back to markers.
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(saved?.settings.pointStyle).toBe('markers');
    });
  });

  it('offers the attributes of connected data to colour and size by, never as typed text', () => {
    render(
      <Fields
        layers={[{ datasetId: '00000000-0000-4000-8000-000000000001', label: 'Parks' }]}
        pointStyle="circles"
      />,
    );

    expect(screen.getByText('More options')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: 'Color by attribute' }));
    expect(screen.getByRole('option', { name: 'Automatic' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Category' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Visitors' })).toBeInTheDocument();
    // Free text with too many values cannot be a colour.
    expect(screen.queryByRole('option', { name: 'Notes' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Size by attribute')).toBeInTheDocument();
  });
});
