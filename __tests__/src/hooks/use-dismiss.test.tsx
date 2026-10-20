import { useRef, useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDismiss } from '@hooks/use-dismiss';

function Popup({ dismissals }: { readonly dismissals: string[] }) {
  const [isOpen, setIsOpen] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismiss(isOpen, rootRef, (reason) => {
    dismissals.push(reason);
    setIsOpen(false);
  });

  return (
    <>
      <button type="button">Outside</button>
      <div ref={rootRef}>
        <button type="button">Inside</button>
        {isOpen && <p>Open</p>}
      </div>
    </>
  );
}

describe('useDismiss', () => {
  it('dismisses on a pointer press outside, not inside', () => {
    const dismissals: string[] = [];
    render(<Popup dismissals={dismissals} />);

    fireEvent.pointerDown(screen.getByText('Inside'));
    expect(dismissals).toEqual([]);

    fireEvent.pointerDown(screen.getByText('Outside'));
    expect(dismissals).toEqual(['outside']);
    expect(screen.queryByText('Open')).not.toBeInTheDocument();
  });

  it('dismisses on Escape and consumes the key, so an enclosing dialog stays', () => {
    const dismissals: string[] = [];
    render(<Popup dismissals={dismissals} />);

    const notPrevented = fireEvent.keyDown(document, { key: 'Escape' });

    expect(dismissals).toEqual(['escape']);
    expect(notPrevented).toBe(false);
  });

  it('ignores other keys', () => {
    const dismissals: string[] = [];
    render(<Popup dismissals={dismissals} />);

    fireEvent.keyDown(document, { key: 'Enter' });

    expect(dismissals).toEqual([]);
  });

  it('listens to nothing while closed', () => {
    const dismissals: string[] = [];
    render(<Popup dismissals={dismissals} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.pointerDown(screen.getByText('Outside'));

    expect(dismissals).toEqual(['escape']);
  });
});
