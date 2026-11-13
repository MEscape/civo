import { useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RadioCardGroup } from '@components/shared/select-field';

const options = [
  { value: 'square', label: 'Square', description: 'Straight corners' },
  { value: 'round', label: 'Round' },
];

function Choice() {
  const [value, setValue] = useState('square');
  return (
    <RadioCardGroup
      legend="Shape"
      name="shape"
      value={value}
      onValueChange={setValue}
      options={options}
    />
  );
}

describe('RadioCardGroup', () => {
  it('labels its group and updates selection through its visible cards', () => {
    render(<Choice />);
    expect(screen.getByRole('radiogroup', { name: 'Shape' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Square/ })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Round' }));
    expect(screen.getByRole('radio', { name: 'Round' })).toBeChecked();
  });

  it('associates error feedback with the group and refuses changes when disabled', () => {
    const change = vi.fn();
    render(
      <RadioCardGroup
        legend="Shape"
        name="shape"
        value="square"
        onValueChange={change}
        options={options}
        error="Select an available shape"
        disabled
      />,
    );
    expect(screen.getByRole('radiogroup')).toHaveAccessibleDescription('Select an available shape');
    expect(screen.getByRole('radio', { name: 'Round' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Round' }));
    expect(change).not.toHaveBeenCalled();
  });
});
