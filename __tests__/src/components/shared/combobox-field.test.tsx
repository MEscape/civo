import { useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ComboboxField } from '@components/shared/combobox-field';
import {
  createCandidate,
  filterComboboxOptions,
  intentForKey,
} from '@components/shared/combobox-model';

const OPTIONS = [
  { value: 'wheelchair', label: 'Wheelchair access' },
  { value: 'buero', label: 'Büro' },
  { value: 'sign-language', label: 'Sign language' },
] as const;

describe('combobox model', () => {
  const find = (query: string, selectedValues: string[] = [], hideSelected = false) =>
    filterComboboxOptions({
      options: OPTIONS,
      query,
      selectedValues,
      hideSelected,
      matchLocally: true,
    }).map((option) => option.value);

  it('matches case-insensitively and ignores accents', () => {
    expect(find('BURO')).toEqual(['buero']);
    expect(find('lang')).toEqual(['sign-language']);
  });

  it('hides selected values only when asked', () => {
    expect(find('', ['buero'], true)).toHaveLength(2);
    expect(find('', ['buero'], false)).toHaveLength(3);
  });

  it('offers no creation for empty, existing or already chosen values', () => {
    const normalize = (raw: string) => raw.trim();
    const offer = (query: string, selectedValues: string[] = []) =>
      createCandidate({ query, options: OPTIONS, selectedValues, normalize });
    expect(offer('  ')).toBeNull();
    expect(offer('buero')).toBeNull();
    expect(offer('new', ['new'])).toBeNull();
    expect(offer(' new ')).toBe('new');
  });

  it('reads keys as intents: Enter picks only while the list is open, so it never submits a closed one', () => {
    const open = { isOpen: true, query: '', canCreate: false, hasChips: false };
    expect(intentForKey('Enter', open)).toEqual({ kind: 'pick' });
    expect(intentForKey('Enter', { ...open, isOpen: false })).toEqual({ kind: 'ignore' });
    expect(intentForKey('ArrowUp', open)).toEqual({ kind: 'move', step: -1 });
    expect(intentForKey(',', open)).toEqual({ kind: 'ignore' });
    expect(intentForKey(',', { ...open, canCreate: true })).toEqual({ kind: 'create' });
    expect(intentForKey('Backspace', { ...open, hasChips: true })).toEqual({ kind: 'remove-last' });
    expect(intentForKey('Backspace', { ...open, hasChips: true, query: 'x' })).toEqual({
      kind: 'ignore',
    });
  });
});

function MultipleHarness({
  onChange,
}: {
  readonly onChange?: (values: readonly string[]) => void;
}) {
  const [values, setValues] = useState<readonly string[]>(['buero']);
  return (
    <form>
      <ComboboxField
        selectionMode="multiple"
        id="skills"
        label="Capabilities"
        options={OPTIONS}
        values={values}
        emptyText="Nothing found"
        createText={(value) => `Add "${value}"`}
        removeText={(label) => `Remove ${label}`}
        onValuesChange={(next) => {
          setValues(next);
          onChange?.(next);
        }}
      />
    </form>
  );
}

describe('ComboboxField', () => {
  it('shows chosen values as removable chips', () => {
    const onChange = vi.fn();
    render(<MultipleHarness onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Büro' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('picks with the keyboard and does not submit the form', () => {
    const onSubmit = vi.fn((event: Event) => {
      event.preventDefault();
    });
    const onChange = vi.fn();
    const { container } = render(<MultipleHarness onChange={onChange} />);
    container.querySelector('form')?.addEventListener('submit', onSubmit);
    const input = screen.getByRole('combobox', { name: 'Capabilities' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'sign' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['buero', 'sign-language']);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('moves through the list with the arrow keys', () => {
    const onChange = vi.fn();
    render(<MultipleHarness onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Capabilities' });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['buero', 'sign-language']);
  });

  it('creates a value from typed text, by Enter row or comma', () => {
    const onChange = vi.fn();
    render(<MultipleHarness onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Capabilities' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'induction loop' } });
    expect(screen.getByRole('option', { name: 'Add "induction loop"' })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: ',' });
    expect(onChange).toHaveBeenCalledWith(['buero', 'induction loop']);
  });

  it('removes the last chip with Backspace on an empty field', () => {
    const onChange = vi.fn();
    render(<MultipleHarness onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Capabilities' }), { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('closes on Escape and keeps the choice list out of the tab order', () => {
    render(<MultipleHarness />);
    const input = screen.getByRole('combobox', { name: 'Capabilities' });
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('selects a single value and shows its label', () => {
    const onValueChange = vi.fn();
    render(
      <ComboboxField
        selectionMode="single"
        id="category"
        label="Category"
        options={OPTIONS}
        value="buero"
        emptyText="Nothing found"
        onValueChange={onValueChange}
      />,
    );
    const input = screen.getByRole<HTMLInputElement>('combobox', { name: 'Category' });
    expect(input.value).toBe('Büro');
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Sign language' }));
    expect(onValueChange).toHaveBeenCalledWith('sign-language');
  });

  it('says so when nothing matches', () => {
    render(<MultipleHarness />);
    const input = screen.getByRole('combobox', { name: 'Capabilities' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByRole('option', { name: 'Add "zzz"' })).toBeInTheDocument();
  });
});
