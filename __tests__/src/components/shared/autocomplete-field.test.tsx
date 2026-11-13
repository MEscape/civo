import { useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AutocompleteField } from '@components/shared/select-field';

const OPTIONS = [{ value: 'Europe/Berlin', detail: 'CEST' }, { value: 'Europe/Zurich' }];

function Harness({
  options = OPTIONS,
  isSearching = false,
  onPick,
  disabled = false,
}: {
  options?: typeof OPTIONS;
  isSearching?: boolean;
  onPick?: () => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  return (
    <AutocompleteField
      id="zone"
      label="Zone"
      hint="Type a city"
      value={value}
      onValueChange={setValue}
      onPick={onPick}
      options={options}
      isSearching={isSearching}
      searchingLabel="Searching"
      disabled={disabled}
    />
  );
}

describe('AutocompleteField', () => {
  it('stays closed until something is typed, then lists the options with their detail', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Zone' });
    fireEvent.focus(input);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'eu' } });

    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Europe/BerlinCEST',
      'Europe/Zurich',
    ]);
  });

  it('moves through the list with the arrows, picks with Enter and closes after picking', () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'eu' } });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1]?.id);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('Europe/Berlin');
    expect(onPick).toHaveBeenCalledWith(OPTIONS[0]);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('picks with the pointer, closes on Escape and when focus leaves, and keeps typed text', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'eu' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'eur' } });
    fireEvent.blur(input);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('eur');

    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Europe/Zurich' }));
    expect(input).toHaveValue('Europe/Zurich');
  });

  it('says it is searching while there is nothing to list yet, and does not open when disabled', () => {
    const { rerender } = render(<Harness options={[]} isSearching />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'ber' } });
    expect(screen.getByRole('status')).toHaveTextContent('Searching');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveValue('ber');

    rerender(<Harness disabled />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
