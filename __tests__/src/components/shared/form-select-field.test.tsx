import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { createDataSourceAction } from '@modules/data-sources/presentation/actions/create-data-source-action';
import { DataSourceForm } from '@modules/data-sources/presentation/components/data-source-form';
import enDataSources from '@modules/data-sources/presentation/i18n/en.json';

import { FormSelectField } from '@components/shared/form-select-field';
import { SelectField } from '@components/shared/select-field';

vi.mock('@modules/data-sources/presentation/actions/create-data-source-action', () => ({
  createDataSourceAction: vi.fn(),
}));

const OPTIONS = [
  { value: 'sm', label: 'Slight' },
  { value: 'lg', label: 'Strong' },
] as const;

interface Values {
  readonly radius: string;
}

function Harness({
  onSubmit,
  error,
}: {
  readonly onSubmit: (values: Values) => void;
  readonly error?: string;
}) {
  const form = useForm<Values>({ defaultValues: { radius: 'sm' } });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FormSelectField
        control={form.control}
        name="radius"
        id="radius"
        label="Corner radius"
        options={OPTIONS}
        errorText={() => error}
      />
      <button type="submit">Save</button>
    </form>
  );
}

function openList(name: string) {
  fireEvent.keyDown(screen.getByRole('combobox', { name }), { key: 'Enter' });
  return screen.findByRole('listbox');
}

async function choose(list: HTMLElement, label: string) {
  const option = within(list).getByRole('option', { name: label });
  await act(async () => {
    fireEvent.keyDown(option, { key: 'Enter' });
    await Promise.resolve();
  });
}

describe('FormSelectField', () => {
  it('shows the current value under an accessible label', () => {
    render(<Harness onSubmit={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Corner radius' })).toHaveTextContent('Slight');
  });

  it('offers every option when opened', async () => {
    render(<Harness onSubmit={vi.fn()} />);

    const list = await openList('Corner radius');

    expect(
      within(list)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Slight', 'Strong']);
  });

  it('writes the chosen option into the form', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await choose(await openList('Corner radius'), 'Strong');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenCalledWith({ radius: 'lg' }, expect.anything());
  });

  it('ties its error message to the control', () => {
    render(<Harness onSubmit={vi.fn()} error="Pick a radius" />);

    const control = screen.getByRole('combobox', { name: 'Corner radius' });
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAccessibleDescription('Pick a radius');
  });
});

describe('SelectField', () => {
  it('works controlled, without a form library', async () => {
    const onValueChange = vi.fn();
    render(
      <SelectField
        id="radius"
        label="Corner radius"
        options={OPTIONS}
        value="sm"
        onValueChange={onValueChange}
      />,
    );

    await choose(await openList('Corner radius'), 'Strong');

    expect(onValueChange).toHaveBeenCalledWith('lg');
  });
});

describe('the data source form', () => {
  it('lets the authentication mode be chosen and sends it', async () => {
    const create = vi.mocked(createDataSourceAction);
    create.mockResolvedValue({
      ok: true,
      data: {
        id: 'source-1',
        websiteId: 'site-1',
        name: 'City API',
        kind: 'REST',
        status: 'UNKNOWN',
        endpoint: 'https://city.example.org/api',
        lastCheckedAt: null,
        lastErrorCode: null,
        createdAt: '2030-01-01T00:00:00.000Z',
        updatedAt: '2030-01-01T00:00:00.000Z',
        datasets: [],
      },
    });
    const onSaved = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={enDataSources} timeZone="UTC">
        <DataSourceForm websiteId="site-1" onCancel={vi.fn()} onSaved={onSaved} />
      </NextIntlClientProvider>,
    );

    fireEvent.change(screen.getByLabelText('Source name'), { target: { value: 'City API' } });
    fireEvent.change(screen.getByLabelText('API base URL'), {
      target: { value: 'https://city.example.org/api' },
    });
    await choose(await openList('Authentication'), 'API key');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await Promise.resolve();
    });

    expect(create).toHaveBeenCalledWith({
      websiteId: 'site-1',
      name: 'City API',
      kind: 'REST',
      config: { baseUrl: 'https://city.example.org/api', authMode: 'API_KEY' },
    });
  });
});
