import type { FocusEvent, KeyboardEvent } from 'react';

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePasswordField } from '@modules/auth/presentation/hooks/use-password-field';

function createKeyboardEvent(isCapsLock: boolean): KeyboardEvent<HTMLInputElement> {
  return {
    getModifierState: (key: string) => key === 'CapsLock' && isCapsLock,
  } as unknown as KeyboardEvent<HTMLInputElement>;
}

function createBlurEvent(): FocusEvent<HTMLInputElement> {
  return {} as unknown as FocusEvent<HTMLInputElement>;
}

describe('usePasswordField', () => {
  it('toggles password visibility', () => {
    const { result } = renderHook(() =>
      usePasswordField({
        id: 'test-field',
        hasHint: false,
        hasError: false,
        guidanceId: undefined,
        onBlur: undefined,
        onKeyDown: undefined,
        onKeyUp: undefined,
      }),
    );

    expect(result.current.isVisible).toBe(false);

    act(() => {
      result.current.toggleVisible();
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      result.current.toggleVisible();
    });
    expect(result.current.isVisible).toBe(false);
  });

  it('tracks CapsLock on keydown/keyup and clears it on blur while calling user callbacks', () => {
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();
    const onBlur = vi.fn();

    const { result } = renderHook(() =>
      usePasswordField({
        id: 'pwd',
        hasHint: false,
        hasError: false,
        guidanceId: undefined,
        onBlur,
        onKeyDown,
        onKeyUp,
      }),
    );

    expect(result.current.isCapsLockOn).toBe(false);

    const downEvent = createKeyboardEvent(true);
    act(() => {
      result.current.inputHandlers.onKeyDown(downEvent);
    });
    expect(result.current.isCapsLockOn).toBe(true);
    expect(onKeyDown).toHaveBeenCalledWith(downEvent);

    const upEvent = createKeyboardEvent(true);
    act(() => {
      result.current.inputHandlers.onKeyUp(upEvent);
    });
    expect(result.current.isCapsLockOn).toBe(true);
    expect(onKeyUp).toHaveBeenCalledWith(upEvent);

    const blurEvent = createBlurEvent();
    act(() => {
      result.current.inputHandlers.onBlur(blurEvent);
    });
    expect(result.current.isCapsLockOn).toBe(false);
    expect(onBlur).toHaveBeenCalledWith(blurEvent);
  });

  it('builds aria-describedby combining hint, error, caps lock, and guidance', () => {
    const { result, rerender } = renderHook((props) => usePasswordField(props), {
      initialProps: {
        id: 'login-password',
        hasHint: false,
        hasError: false,
        guidanceId: undefined as string | undefined,
        onBlur: undefined,
        onKeyDown: undefined,
        onKeyUp: undefined,
      },
    });

    expect(result.current.describedBy).toBeUndefined();

    rerender({
      id: 'login-password',
      hasHint: true,
      hasError: false,
      guidanceId: undefined,
      onBlur: undefined,
      onKeyDown: undefined,
      onKeyUp: undefined,
    });
    expect(result.current.describedBy).toBe('login-password-hint');

    rerender({
      id: 'login-password',
      hasHint: true,
      hasError: true,
      guidanceId: 'extra-guidance',
      onBlur: undefined,
      onKeyDown: undefined,
      onKeyUp: undefined,
    });
    expect(result.current.describedBy).toBe(
      'login-password-hint login-password-error extra-guidance',
    );

    act(() => {
      result.current.inputHandlers.onKeyDown(createKeyboardEvent(true));
    });
    expect(result.current.describedBy).toBe(
      'login-password-hint login-password-error login-password-caps extra-guidance',
    );
  });
});
