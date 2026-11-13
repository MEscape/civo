'use client';

import { useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';

import { isDefined } from '@lib/utils';

export interface PasswordFieldState {
  readonly id: string;
  readonly hasHint: boolean;
  readonly hasError: boolean;
  readonly guidanceId: string | undefined;
  readonly onBlur: ((event: FocusEvent<HTMLInputElement>) => void) | undefined;
  readonly onKeyDown: ((event: KeyboardEvent<HTMLInputElement>) => void) | undefined;
  readonly onKeyUp: ((event: KeyboardEvent<HTMLInputElement>) => void) | undefined;
}

/**
 * What a password input needs beyond its value: whether the text is shown, whether Caps Lock is on
 * (tracked on key events, cleared on blur), the ids its hint, error and warning get, and the
 * `aria-describedby` that joins the ones on screen. The caller's own handlers still run.
 */
export function usePasswordField({
  id,
  hasHint,
  hasError,
  guidanceId,
  onBlur,
  onKeyDown,
  onKeyUp,
}: PasswordFieldState) {
  const [isVisible, setIsVisible] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const ids = { hint: `${id}-hint`, error: `${id}-error`, caps: `${id}-caps` };
  const describedBy = [
    hasHint ? ids.hint : null,
    hasError ? ids.error : null,
    isCapsLockOn ? ids.caps : null,
    guidanceId ?? null,
  ]
    .filter(isDefined)
    .join(' ');

  function trackCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setIsCapsLockOn(event.getModifierState('CapsLock'));
  }

  return {
    isVisible,
    isCapsLockOn,
    ids,
    describedBy: describedBy === '' ? undefined : describedBy,
    toggleVisible: () => {
      setIsVisible((current) => !current);
    },
    inputHandlers: {
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
        trackCapsLock(event);
        onKeyDown?.(event);
      },
      onKeyUp: (event: KeyboardEvent<HTMLInputElement>) => {
        trackCapsLock(event);
        onKeyUp?.(event);
      },
      onBlur: (event: FocusEvent<HTMLInputElement>) => {
        setIsCapsLockOn(false);
        onBlur?.(event);
      },
    },
  };
}
