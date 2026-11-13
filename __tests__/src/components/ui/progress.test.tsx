import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Progress } from '@components/ui/progress';

describe('Progress', () => {
  it.each([
    { value: -5, expected: '0' },
    { value: 150, expected: '100' },
    { value: 25, expected: '25' },
  ])('clamps $value to its accessible range', ({ value, expected }) => {
    render(<Progress value={value} aria-label="Setup progress" />);
    expect(screen.getByRole('progressbar', { name: 'Setup progress' })).toHaveAttribute(
      'aria-valuenow',
      expected,
    );
  });

  it('preserves a custom maximum and defaults invalid maxima', () => {
    const { rerender } = render(<Progress value={1} max={3} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '3');
    rerender(<Progress max={0} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('represents indeterminate progress without announcing a false percentage', () => {
    render(<Progress value={null} />);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });
});
