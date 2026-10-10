import type { ReactElement } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import type { PropFieldDescriptor } from '@modules/builder/application/contracts/builder-constraints';
import { createComponentCatalog } from '@modules/builder/application/contracts/editor-model';
import { CategoryControl } from '@modules/builder/presentation/components/properties/controls/category-control';
import { ColumnsControl } from '@modules/builder/presentation/components/properties/controls/columns-control';
import type { ControlProps } from '@modules/builder/presentation/components/properties/controls/control-props';
import { DatasetsControl } from '@modules/builder/presentation/components/properties/controls/datasets-control';
import { NumberControl } from '@modules/builder/presentation/components/properties/controls/number-control';
import enBuilder from '@modules/builder/presentation/i18n/en.json';
import { BuilderSessionContext } from '@modules/builder/presentation/state/builder-session-context';
import type { BuilderSession } from '@modules/builder/presentation/state/builder-session-context';

function field(overrides: Partial<PropFieldDescriptor>): PropFieldDescriptor {
  return {
    key: 'prop',
    control: 'text',
    labelKey: 'label',
    placeholderKey: null,
    group: null,
    options: [],
    bounds: null,
    canonicalKind: null,
    defaultValue: null,
    itemFields: [],
    ...overrides,
  };
}

function controlProps(overrides: Partial<ControlProps>): ControlProps {
  return {
    id: 'control',
    labelId: 'control-label',
    field: field({}),
    value: undefined,
    nodeProps: {},
    onChange: vi.fn(),
    onCommit: vi.fn(),
    ...overrides,
  };
}

const SESSION: BuilderSession = {
  catalog: createComponentCatalog([]),
  datasetOptions: {
    WasteCollectionEntry: [
      { id: 'ds-1', name: 'North', sourceName: 'Waste API' },
      { id: 'ds-2', name: 'South', sourceName: 'Waste API' },
      { id: 'ds-3', name: 'Yellow bag', sourceName: 'Waste API' },
    ],
  },
  categoryOptions: {
    byDataset: { 'ds-1': ['Nord'], 'ds-2': ['Süd', 'Mitte'] },
    sampleByKind: { WasteCollectionEntry: ['Bezirk A'] },
  },
};

function renderControl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={enBuilder} timeZone="UTC">
      <BuilderSessionContext.Provider value={SESSION}>{ui}</BuilderSessionContext.Provider>
    </NextIntlClientProvider>,
  );
}

describe('NumberControl', () => {
  const limit = field({ control: 'number', bounds: { min: 1, max: 10 }, defaultValue: 3 });

  it('shows the value it is given, which is the default while nothing is stored', () => {
    renderControl(<NumberControl {...controlProps({ field: limit, value: 3 })} />);

    expect(screen.getByRole('spinbutton')).toHaveValue(3);
  });

  it('reports a typed number', () => {
    const onChange = vi.fn();
    renderControl(<NumberControl {...controlProps({ field: limit, value: 3, onChange })} />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } });

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('lets the field be emptied for retyping without storing anything, then restores the value on blur', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    renderControl(
      <NumberControl {...controlProps({ field: limit, value: 3, onChange, onCommit })} />,
    );
    const input = screen.getByRole('spinbutton');

    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue(null);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(input).toHaveValue(3);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});

describe('ColumnsControl', () => {
  const columns = field({
    control: 'columns',
    options: [1, 2, 3, 4].map((value) => ({ value, labelKey: null })),
    defaultValue: 3,
  });

  it('highlights the column count in force', () => {
    renderControl(<ColumnsControl {...controlProps({ field: columns, value: 3 })} />);

    expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('stores a chosen count and ends the undo step', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    renderControl(
      <ColumnsControl {...controlProps({ field: columns, value: 3, onChange, onCommit })} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '2' }));

    expect(onChange).toHaveBeenCalledWith(2);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});

describe('DatasetsControl', () => {
  const datasets = field({
    control: 'datasets',
    canonicalKind: 'WasteCollectionEntry',
    bounds: { min: 0, max: 2 },
  });

  it('lists the compatible datasets except the primary one', () => {
    renderControl(
      <DatasetsControl
        {...controlProps({ field: datasets, value: [], nodeProps: { datasetId: 'ds-1' } })}
      />,
    );

    expect(screen.queryByRole('checkbox', { name: /North/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /South/ })).not.toBeChecked();
  });

  it('adds and removes a dataset', () => {
    const onChange = vi.fn();
    renderControl(
      <DatasetsControl
        {...controlProps({ field: datasets, value: ['ds-2'], nodeProps: {}, onChange })}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /Yellow bag/ }));
    expect(onChange).toHaveBeenLastCalledWith(['ds-2', 'ds-3']);

    fireEvent.click(screen.getByRole('checkbox', { name: /South/ }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('stops offering more datasets once the limit is reached', () => {
    renderControl(
      <DatasetsControl
        {...controlProps({
          field: datasets,
          value: ['ds-2', 'ds-3'],
          nodeProps: { datasetId: 'ds-1' },
        })}
      />,
    );

    // The primary dataset is not a choice; both remaining ones are selected, so both stay switchable off.
    expect(screen.getByRole('checkbox', { name: /South/ })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: /Yellow bag/ })).toBeEnabled();
  });

  it('disables an unselected dataset when the limit is reached', () => {
    renderControl(
      <DatasetsControl
        {...controlProps({ field: { ...datasets, bounds: { min: 0, max: 1 } }, value: ['ds-2'] })}
      />,
    );

    expect(screen.getByRole('checkbox', { name: /North/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /South/ })).toBeEnabled();
  });

  it('says so when there is nothing to choose from', () => {
    renderControl(
      <DatasetsControl
        {...controlProps({ field: { ...datasets, canonicalKind: 'Event' }, value: [] })}
      />,
    );

    expect(screen.getByText('No compatible datasets yet.')).toBeInTheDocument();
  });
});

describe('CategoryControl', () => {
  const district = field({ control: 'category', canonicalKind: 'WasteCollectionEntry' });

  function open() {
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    return screen.findByRole('listbox');
  }

  it('shows "all categories" while no category is chosen', () => {
    renderControl(<CategoryControl {...controlProps({ field: district })} />);

    expect(screen.getByRole('combobox')).toHaveTextContent('All categories');
  });

  it('offers the sample categories while no dataset is bound', async () => {
    renderControl(<CategoryControl {...controlProps({ field: district })} />);

    const options = within(await open()).getAllByRole('option');

    expect(options.map((option) => option.textContent)).toEqual(['All categories', 'Bezirk A']);
  });

  it('offers the categories of the datasets the node is bound to', async () => {
    renderControl(
      <CategoryControl
        {...controlProps({
          field: district,
          nodeProps: { datasetId: 'ds-1', additionalDatasetIds: ['ds-2'] },
        })}
      />,
    );

    const options = within(await open()).getAllByRole('option');

    expect(options.map((option) => option.textContent)).toEqual([
      'All categories',
      'Mitte',
      'Nord',
      'Süd',
    ]);
  });

  it('keeps a stored category that the data no longer offers visible', () => {
    renderControl(
      <CategoryControl {...controlProps({ field: district, value: 'Bezirk Z', nodeProps: {} })} />,
    );

    expect(screen.getByRole('combobox')).toHaveTextContent('Bezirk Z (not in the data)');
  });
});
