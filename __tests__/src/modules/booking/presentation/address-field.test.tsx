import { useState } from 'react';

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { searchAddressesAction } from '@modules/booking/presentation/actions/search-addresses-action';
import { AddressField } from '@modules/booking/presentation/components/admin/address-field.client';

import { renderBooking } from './ui-support';

vi.mock('@modules/booking/presentation/actions/search-addresses-action', () => ({
  searchAddressesAction: vi.fn(),
}));

const search = vi.mocked(searchAddressesAction);

function Harness({ onChange }: { readonly onChange?: (address: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <AddressField
      id="address"
      value={value}
      error={undefined}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const input = () => screen.getByRole<HTMLInputElement>('combobox', { name: 'Address' });

function type(text: string) {
  fireEvent.focus(input());
  fireEvent.change(input(), { target: { value: text } });
}

beforeEach(() => {
  search.mockReset();
  search.mockResolvedValue({
    ok: true,
    data: [{ key: 'a1', label: 'Marktplatz 1, 10115 Berlin, Germany' }],
  });
});

describe('the address field', () => {
  it('suggests addresses once typing pauses, and picks one', async () => {
    const onChange = vi.fn();
    renderBooking(<Harness onChange={onChange} />);
    type('Marktplatz');

    const option = await screen.findByRole('option', {
      name: 'Marktplatz 1, 10115 Berlin, Germany',
    });
    fireEvent.mouseDown(option);

    expect(onChange).toHaveBeenLastCalledWith('Marktplatz 1, 10115 Berlin, Germany');
    expect(search).toHaveBeenCalledWith({ query: 'Marktplatz' });
  });

  it('waits for a pause instead of asking at every keystroke', async () => {
    renderBooking(<Harness />);
    type('Mar');
    type('Mark');
    type('Markt');

    await waitFor(() => {
      expect(search).toHaveBeenCalledTimes(1);
    });
    expect(search).toHaveBeenCalledWith({ query: 'Markt' });
  });

  it('does not ask for a query too short to mean anything', async () => {
    renderBooking(<Harness />);
    type('Ma');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450));
    });

    expect(search).not.toHaveBeenCalled();
  });

  it('shows the answer to the latest query, never a slower earlier one', async () => {
    let releaseFirst: (value: Awaited<ReturnType<typeof searchAddressesAction>>) => void = () => {};
    search.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirst = resolve;
        }),
    );
    search.mockResolvedValueOnce({ ok: true, data: [{ key: 'n', label: 'New answer 2, Berlin' }] });
    renderBooking(<Harness />);

    type('Old query');
    await waitFor(() => {
      expect(search).toHaveBeenCalledTimes(1);
    });
    type('New query');
    await screen.findByRole('option', { name: 'New answer 2, Berlin' });
    await act(async () => {
      releaseFirst({ ok: true, data: [{ key: 'o', label: 'Old answer 1, Berlin' }] });
    });

    expect(screen.queryByRole('option', { name: 'Old answer 1, Berlin' })).toBeNull();
    expect(screen.getByRole('option', { name: 'New answer 2, Berlin' })).toBeInTheDocument();
  });

  it('keeps an address the person typed themselves, even when nothing is suggested', async () => {
    search.mockResolvedValue({ ok: true, data: [] });
    const onChange = vi.fn();
    renderBooking(<Harness onChange={onChange} />);
    type('Neubau Hinterhof 7');

    await screen.findByRole('option', { name: 'Use “Neubau Hinterhof 7” as typed' });
    fireEvent.blur(input());

    expect(onChange).toHaveBeenLastCalledWith('Neubau Hinterhof 7');
  });

  it('says so, and still allows typing, when the search is unavailable', async () => {
    search.mockResolvedValue({ ok: false, error: { code: 'x', message: 'x' } });
    renderBooking(<Harness />);
    type('Marktplatz');

    expect(
      await screen.findByRole('option', { name: 'Use “Marktplatz” as typed' }),
    ).toBeInTheDocument();
  });
});
