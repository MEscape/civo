import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useBeforeUnloadGuard } from '@hooks/use-before-unload-guard';

function leaving() {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('useBeforeUnloadGuard', () => {
  it('protects dirty work only while active and removes protection on unmount', () => {
    const { rerender, unmount } = renderHook(
      ({ dirty }) => {
        useBeforeUnloadGuard(dirty);
      },
      { initialProps: { dirty: false } },
    );
    expect(leaving()).toBe(false);
    rerender({ dirty: true });
    expect(leaving()).toBe(true);
    rerender({ dirty: false });
    expect(leaving()).toBe(false);
    rerender({ dirty: true });
    unmount();
    expect(leaving()).toBe(false);
  });
});
