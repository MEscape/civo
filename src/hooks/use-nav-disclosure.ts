'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';

import { useDismiss } from './use-dismiss';

/** Owns disclosure state and returns focus to the trigger when Escape dismisses it. */
export function useNavDisclosure() {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Activity hiding the page closes it, so it is not open when the page is shown again.
  useLayoutEffect(
    () => () => {
      setIsOpen(false);
    },
    [],
  );

  useDismiss(isOpen, rootRef, (reason) => {
    setIsOpen(false);
    if (reason === 'escape') {
      buttonRef.current?.focus();
    }
  });

  return {
    isOpen,
    panelId,
    rootRef,
    buttonRef,
    toggle: () => {
      setIsOpen((open) => !open);
    },
    close: () => {
      setIsOpen(false);
    },
  };
}
