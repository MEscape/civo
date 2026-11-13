import { Activity, useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FreshOnReturn } from '@modules/booking/presentation/components/shared/fresh-on-return';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        setCount(count + 1);
      }}
    >
      typed {count}
    </button>
  );
}

function Screen({ mode }: { mode: 'visible' | 'hidden' }) {
  return (
    <Activity mode={mode}>
      <FreshOnReturn>
        <Counter />
      </FreshOnReturn>
    </Activity>
  );
}

describe('FreshOnReturn', () => {
  it('keeps what was done while the screen stays', () => {
    render(<Screen mode="visible" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('typed 1');
  });

  it('starts the screen over when it is left and come back to', () => {
    const { rerender } = render(<Screen mode="visible" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('typed 1');

    rerender(<Screen mode="hidden" />);
    rerender(<Screen mode="visible" />);

    expect(screen.getByRole('button')).toHaveTextContent('typed 0');
  });
});
