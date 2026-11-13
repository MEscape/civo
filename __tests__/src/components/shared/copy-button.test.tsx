import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CopyButton } from '@components/shared/page-parts.client';

function clipboard(writeText: (value: string) => Promise<void>) {
  vi.stubGlobal(
    'navigator',
    Object.create(navigator, { clipboard: { value: { writeText }, configurable: true } }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('copy feedback', () => {
  it('copies the supplied value and clears feedback after the existing delay', async () => {
    vi.useFakeTimers();
    const write = vi.fn().mockResolvedValue(undefined);
    clipboard(write);
    render(
      <CopyButton value="https://example.test" label="Copy address" copiedLabel="Address copied" />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy address' }));
    });
    expect(write).toHaveBeenCalledWith('https://example.test');
    expect(screen.getByRole('status')).toHaveTextContent('Address copied');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('does not claim success when clipboard access is refused', async () => {
    clipboard(() => Promise.reject(new Error('permission denied')));
    render(<CopyButton value="address" label="Copy address" copiedLabel="Address copied" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy address' }));
    });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('clears its feedback timer when the control unmounts', async () => {
    vi.useFakeTimers();
    clipboard(() => Promise.resolve());
    const view = render(<CopyButton value="address" label="Copy" copiedLabel="Copied" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
